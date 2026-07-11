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
//   users.findByEmail(email) findById(id) create(user) update(id, patch)
//   works.list({cat,q,limit,offset}) findById(id) findByHash(hash) create(meta,image) getImage(id)
//   boards.listByUser(uid) findByUserAndId(uid,id) create(board) remove(uid,id) togglePin(uid,id,workId)
//   orders.create(order) findById(id)
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
    create: (u) => must().users.create(u),
    update: (id, patch) => must().users.update(id, patch),
  },
  works: {
    list: (opts) => must().works.list(opts || {}),
    findById: (id) => must().works.findById(id),
    findByHash: (h) => must().works.findByHash(h),
    create: (meta, image) => must().works.create(meta, image),
    getImage: (id) => must().works.getImage(id),
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
  newsletter: {
    add: (email, ip) => must().newsletter.add(email, ip),
  },
};
