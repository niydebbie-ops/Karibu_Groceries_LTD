const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("./src/utils/mongoose");
const connectDB = require("./src/utils/db");
const User = require("./src/models/User");

dotenv.config({ path: path.resolve(__dirname, ".env") });

const SEED_USER = {
  fullName: "Mr. Orban",
  email: "orban@2kgl.com",
  password: "orban123!",
  role: "Director"
};

async function seedUsers() {
  try {
    


    const email = String(SEED_USER.email).trim().toLowerCase();
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`Seed user already exists: ${email}`);
      return;
    }

    await User.create({
      fullName: String(SEED_USER.fullName).trim(),
      email,
      password: SEED_USER.password,
      role: String(SEED_USER.role).trim()
    });

    console.log(`Seed user created successfully: ${email}`);
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

module.exports = seedUsers;

