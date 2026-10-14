const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user: cannot read users", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").get());
});

test("Authenticated user: can create and read own user profile", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID,
      displayName: "Alice",
      email: "alice@example.com",
      customTag: "#1337",
      nitroActive: true,
      createdAt: new Date(),
    })
  );
  await assertSucceeds(aliceDb.collection("users").doc(ALICE_UID).get());
});

test("Authenticated user: cannot write other user profile", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertFails(
    aliceDb.collection("users").doc(BOB_UID).set({
      userId: BOB_UID,
      displayName: "Bob Fake",
      email: "bob@example.com",
      createdAt: new Date(),
    })
  );
});

test("Authenticated user: can create server and channel", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("servers").doc("server_1").set({
      ownerId: ALICE_UID,
      name: "Alice Lounge",
      inviteCode: "VTX-1234",
      memberIds: [ALICE_UID],
      boostLevel: 3,
      createdAt: new Date(),
    })
  );

  await assertSucceeds(
    aliceDb.collection("servers").doc("server_1").collection("channels").doc("general").set({
      serverId: "server_1",
      name: "general",
      type: "TEXT",
      isEncrypted: true,
      createdAt: new Date(),
    })
  );
});

test("Authenticated user: can post message in channel", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("servers").doc("server_1").collection("channels").doc("general").collection("messages").doc("msg_1").set({
      serverId: "server_1",
      channelId: "general",
      senderId: ALICE_UID,
      senderName: "Alice",
      content: "Hello Vortex!",
      isEncrypted: false,
      createdAt: new Date(),
    })
  );
});
