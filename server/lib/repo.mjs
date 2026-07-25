// Repository layer — the ONLY data-access surface the routes touch.
//
// Every method is async and storage-agnostic. Two drivers implement it:
//   • file      → server/lib/drivers/file.mjs      (dev / small; single box)
//   • postgres  → server/lib/drivers/postgres.mjs  (Supabase / scale; many boxes)
//
// Pick with DB_DRIVER=file|postgres (default: file, or postgres if DATABASE_URL is set).
// Because routes only ever await this interface, moving from 10 users to 100k is a
// config change, not a rewrite.
//
// Interface (all async):
//   init(): connect / load                     close(): flush / disconnect
//   users.findByEmail(email) findById(id) findByHandle(handle) create(user) update(id, patch)
//   works.list({cat,q,limit,offset}) listByOwner(ownerId) findById(id) findByHash(hash) create(meta,image) getImage(id)
//   stats.incrementView(workId) viewsFor(workIds) -> { workId: views }
//   likes.toggle(workId,userId) likedBy(workId,userId) countByWorks(workIds) -> { workId: count }
//   boards.listByUser(uid) findByUserAndId(uid,id) create(board) remove(uid,id) togglePin(uid,id,workId)
//   orders.create(order) findById(id)
//   comments.listByWork(workId) findById(id) create(c) toggleLike(id,userId) remove(id,userId)
//   passwordResets.create(r) findByHash(hash) consume(hash) removeByUser(userId)
//   newsletter.add(email, ip) -> true if newly added

let impl = null;

function selectDriver() {
  const explicit = (process.env.DB_DRIVER || "").toLowerCase();
  if (explicit) return explicit;
  return process.env.DATABASE_URL ? "postgres" : "file";
}

export async function initRepo() {
  if (impl) return impl;
  const driver = selectDriver();
  const mod =
    driver === "postgres"
      ? await import("./drivers/postgres.mjs")
      : await import("./drivers/file.mjs");
  impl = await mod.createRepo();
  impl.driver = driver;
  return impl;
}

// Lazy proxy so modules can `import { repo }` at top level and call methods after initRepo().
function must() {
  if (!impl) throw new Error("Repository not initialized — call initRepo() during startup.");
  return impl;
}

export const repo = {
  get driver() { return impl ? impl.driver : selectDriver(); },
  close: () => (impl ? impl.close() : Promise.resolve()),
  users: {
    findByEmail: (e) => must().users.findByEmail(e),
    findById: (id) => must().users.findById(id),
    findByHandle: (h) => must().users.findByHandle(h),
    create: (u) => must().users.create(u),
    update: (id, patch) => must().users.update(id, patch),
  },
  works: {
    list: (opts) => must().works.list(opts || {}),
    listByOwner: (ownerId) => must().works.listByOwner(ownerId),
    findById: (id) => must().works.findById(id),
    findByHash: (h) => must().works.findByHash(h),
    create: (meta, image) => must().works.create(meta, image),
    getImage: (id) => must().works.getImage(id),
  },
  stats: {
    incrementView: (workId) => must().stats.incrementView(workId),
    viewsFor: (workIds) => must().stats.viewsFor(workIds),
  },
  likes: {
    toggle: (workId, userId) => must().likes.toggle(workId, userId),
    likedBy: (workId, userId) => must().likes.likedBy(workId, userId),
    countByWorks: (workIds) => must().likes.countByWorks(workIds),
  },
  boards: {
    listByUser: (uid) => must().boards.listByUser(uid),
    findByUserAndId: (uid, id) => must().boards.findByUserAndId(uid, id),
    create: (b) => must().boards.create(b),
    remove: (uid, id) => must().boards.remove(uid, id),
    togglePin: (uid, id, workId) => must().boards.togglePin(uid, id, workId),
  },
  orders: {
    create: (o) => must().orders.create(o),
    findById: (id) => must().orders.findById(id),
  },
  comments: {
    listByWork: (workId) => must().comments.listByWork(workId),
    countByWorks: (workIds) => must().comments.countByWorks(workIds),
    findById: (id) => must().comments.findById(id),
    create: (c) => must().comments.create(c),
    toggleLike: (id, userId) => must().comments.toggleLike(id, userId),
    remove: (id, userId) => must().comments.remove(id, userId),
  },
  passwordResets: {
    create: (r) => must().passwordResets.create(r),
    findByHash: (h) => must().passwordResets.findByHash(h),
    consume: (h) => must().passwordResets.consume(h),
    removeByUser: (uid) => must().passwordResets.removeByUser(uid),
  },
  newsletter: {
    add: (email, ip) => must().newsletter.add(email, ip),
  },
};
