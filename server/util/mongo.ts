import { MongoClient, Db } from "mongodb";

const mongoAdd = "newrecruit.eu";
const mongoName = "";
const mongoPass = "";

async function initDB(): Promise<Db> {
  // Init MongoDB
  const connectionString = `mongodb://${mongoName}:${mongoPass}@${mongoAdd}:27017/" + ${mongoName} + "?authSource=admin`;
  const mongoClient = await MongoClient.connect(connectionString, {});
  const mongodb = mongoClient.db(mongoName);
  console.log("Initiating mongodb");
  return mongodb;
}

const mongo = initDB();

export default mongo;
