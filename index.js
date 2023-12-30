const express = require("express");
const dotenv = require("dotenv");
const Queue = require("bull");
const { createBullBoard } = require("@bull-board/api");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { ExpressAdapter } = require("@bull-board/express");

const Bull = require("bull");
const { promisify } = require("util");
const sleep = promisify(setTimeout);

setupBullBoard();

async function setupBullBoard() {
  dotenv.config();

  // Define the Redis connection options
  const redisOptions = {
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    },
  };

  // Create a new queue with the Redis connection options
  const queuesList = ["burger"];

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  const queues = queuesList
    .map((qs) => new Queue(qs, redisOptions))
    .map((q) => new BullAdapter(q));
  const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues,
    serverAdapter: serverAdapter,
  });

  // Server configuration
  const app = express();
  app.use("/admin/queues", serverAdapter.getRouter());
  app.get("/queue/execute", async (req, res) => {
    await setupQueues();
    res.status(200).json({ message: "Queues being processed!" });
  });
  const PORT = 3000;
  app.listen(PORT, () => {
    console.info(`Running on ${PORT}...`);
    console.info(
      `Open http://localhost:${PORT}/admin/queues to see the Bull Board`
    );
    console.info(
      `Open http://localhost:${PORT}/queue/execute to execute the queues`
    );
  });
}

async function setupQueues() {
  dotenv.config();
  const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = process.env;

  // QUEUE OPTIONS
  const queueOptions = {
    redis: { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD },
    limit: {
      max: 1,
      duration: 1000,
    },
  };

  // DEFINE QUEUE
  const burgerQueue = new Bull("burger", queueOptions);

  // REGISTER PROCESSER
  burgerQueue.process(async (payload, done) => {
    try {
      // STEP 1
      payload.log("Grill the patty.");
      payload.progress(20);
      await sleep(5000);
      // STEP 2
      if (Math.random() > 0.25) throw new Error("Toast burnt!"); // RANDOM ERROR
      payload.log("Toast the buns.");
      payload.progress(40);
      await sleep(5000);
      // STEP 3
      payload.log("Add toppings.");
      payload.progress(60);
      await sleep(5000);
      // STEP 4
      payload.log("");
      payload.log("Assemble layers.");
      payload.progress(80);
      await sleep(5000);
      // STEP 5
      payload.log("Burger ready.");
      await payload.progress(100);
      done();
    } catch (err) {
      done(err);
    }
  });

  //ADD JOBS TO THE QUEUE
  const jobs = [...new Array(10)].map((_) => ({
    bun: "🍔",
    cheese: "🧀",
    toppings: ["🍅", "🫒", "🥒", "🌶️"],
  }));

  jobs.forEach((job, i) =>
    burgerQueue.add(job, { jobId: `Burger#${i + 1}`, attempts: 3 })
  );

  burgerQueue.on("completed", (job) => {
    console.log(`${job.id} completed`);
  });
  burgerQueue.on("failed", (job) => {
    console.log(`${job.id} failed`);
  });
}
