const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");


const URL = process.env.DB || "mongodb://127.0.0.1:27017/fsd13";


mongoose.connect(URL)
    .then(() => console.log("Connected to Mongoose Atlas"))
    .catch(err => console.error("Connection error:", err));

const { Product } = require("./model/products");
const { Users } = require("./model/users");



app.use(express.json());
app.use(cors({ origin: "*" }));



function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Authorization header required" });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Token not found" });
    }
    try {
        const payload = jwt.verify(token, process.env.SECRET_KEY);
        req.user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}

app.post("/register", async (req, res) => {

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (name.length < 3 || name.length > 50) {
        return res.status(400).json({ error: "Name must be between 3 and 50 characters" });
    }

    if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        return res.status(400).json({ error: "Invalid email address" });
    }

    if (password.length < 5 || password.length > 128) {
        return res.status(400).json({ error: "Password must be between 5 and 128 characters" });
    }

    const existingUser = await Users.findOne({ email });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    const verifyUrl = `${process.env.CLIENT_URL}/verify-account/${verificationToken}`;

    let transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const mailOptions = {
        to: email,
        from: process.env.EMAIL_USER,
        subject: "Verify Your Account",
        text: `Thank you for registering.\n\nPlease verify your account by clicking the link below (expires in 24 hours):\n\n${verifyUrl}\n\nIf you did not request this, please ignore this email.`
    };
    
    try{
    
        if (existingUser && !existingUser.isVerified) {
            existingUser.name = name; // allow updating name too if needed
            existingUser.password = hash;
            existingUser.verificationToken = verificationToken;
            existingUser.verificationExpires = verificationExpires;

            await transporter.sendMail(mailOptions);
            await existingUser.save();

            return res.status(200).json({
                message: "Verification email resent. Please check your inbox."
            });
        }

        // If user already exists and is verified
        if (existingUser) {
            return res.status(409).json({ error: "Email address already in use" });
        }

        // New user: send email first
        transporter.sendMail(mailOptions, async (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
                return res.status(500).json({ error: "Error sending verification email" });
            }

            await Users.create({
                name,
                email,
                password: hash,
                isVerified: false,
                verificationToken,
                verificationExpires
            });

            return res.status(201).json({
                message: "Registration successful! Please check your email to verify your account."
            });
        });

    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).json({ error: error.message });
    }
});

// Verification Endpoint – called when user clicks the email link
app.get("/verify-account/:token", async (req, res) => {
    const { token } = req.params;
    try {
        // Find user with matching token and token not expired
        const user = await Users.findOne({
            verificationToken: token,
            verificationExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ error: "Verification link is invalid or has expired." });
        }
        // Mark account as verified and clear token fields
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationExpires = undefined;
        await user.save();
        res.json({ message: "Account verified successfully. You can now login." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (!email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        return res.status(400).json({ error: "Invalid email address" });
    }

    if (password.length < 5 || password.length > 128) {
        return res.status(400).json({ error: "Password must be between 5 and 128 characters" });
    }

    const existingUser = await Users.findOne({ email });
    if (!existingUser) {
        return res.status(401).json({ error: "Email not registered. Sign up for a new account." });
    }

    if (!existingUser.isVerified) {
        return res.status(403).json({ error: "Account not verified. Please check your email to verify your account." });
    }

    try {
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Incorrect password" });
        }

        let token = jwt.sign({ email: existingUser.email }, process.env.SECRET_KEY, { expiresIn: "1h" });
        res.json({ message: "Login Successful", token });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
});


app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required" });
    }
    try {
        const user = await Users.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User with provided email does not exist" });
        }
        const token = crypto.randomBytes(32).toString("hex");
        const expiryTime = Date.now() + 3600000;

        user.resetPasswordToken = token;
        user.resetPasswordExpires = expiryTime;
        await user.save();

        const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

        let transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: "Password Reset Request",
            text: `You are receiving this email because you (or someone else) have requested to reset the password for your account.\n\n
                    Please click on the following link, or paste it into your browser to complete the process:\n\n
                    ${resetLink}\n\n
                    This link will expire in one hour.\n\n
                    If you did not request this, please ignore this email.`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
                return res.status(500).json({ error: "Error sending password reset email" });
            }
            res.json({ message: "Password reset link has been sent to your email" });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/reset-password/verify", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  try {
    const user = await Users.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    return res.json({ username: user.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
    }

    if (newPassword.length < 5 || newPassword.length > 128) {
        return res.status(400).json({ error: "Password must be between 5 and 128 characters" });
    }

    try {
        // Find the user by the token and check if the token is not expired
        const user = await Users.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: "Invalid or expired token" });
        }

        // Hash the new password and update
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        // Clear the reset token and expiry after successful password update
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/products", authenticate, async (req, res) => {
    const products = await Product.find();
    res.json(products);
    console.log(req);
});


app.listen(3001)