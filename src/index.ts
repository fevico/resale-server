import "dotenv/config";
import "express-async-errors";
import "src/db";
import express from "express";
import authRouter from "routes/auth";
import formidable from "formidable";
import path from "path";
import productRouter from "./routes/product";
import { sendErrorRes } from "./utils/helper";
import { Server } from "socket.io";
import http from "http";
import { TokenExpiredError, verify } from "jsonwebtoken";
import morgan from "morgan";
import conversationRouter from "./routes/conversation";
import ConversationModel from "./models/conversation";

const app = express();
app.use(morgan("dev"));
const server = http.createServer(app);
const io = new Server(server, {
  path: "/socket-message",
});

app.use(express.static("src/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
app.use("/auth", authRouter);
app.use("/product", productRouter);
app.use("/conversation", conversationRouter);

// SOCKET IO
io.use((socket, next) => {
  const socketReq = socket.handshake.auth as { token: string } | undefined;
  if (!socketReq?.token) {
    return next(new Error("Unauthorized request!"));
  }
  try {
    socket.data.jwtDecode = verify(socketReq.token, process.env.JWT_SECRET!);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(new Error("jwt expired!"));
    }
    return next(new Error("Invalid Token!"));
  }
  next();
});

type IncomingMessage = {
  message: {
    id: string;
    time: string;
    text: string;
    user: {
      id: string;
      name: string;
      avatar?: string;
    };
  };
  to: string;
  conversationId: string;
};

type OutGoingMessageResponse = {
  message: {
    id: string;
    time: string;
    text: string;
    user: {
      id: string;
      name: string;
      avatar?: string;
    };
  };
  from: {
    id: string;
    name: string;
    avatar?: string;
  };
  conversationId: string;
};

io.on("connection", (socket) => {
  const socketData = socket.data as { jwtDecode: { id: string } };
  const userId = socketData.jwtDecode.id;

  socket.join(userId);
  console.log("user is connected");
  socket.on("new_message", async (data: IncomingMessage) => {
    const { conversationId, to, message } = data;
    await ConversationModel.findByIdAndUpdate(conversationId, {
      $push: {
        chats: {
          sentBy: message.user.id,
          content: message.text,
          timestamp: message.time,
        },
      },
    });

    const messageResponse: OutGoingMessageResponse = {
      from: message.user,
      conversationId,
      message: message,
    };

    socket.to(to).emit("chat:message", messageResponse);
  });
});

// this is how you can upload files
app.post("/upload-file", async (req, res) => {
  const form = formidable({
    uploadDir: path.join(__dirname, "public"),
    filename(name, ext, part, form) {
      return Date.now() + "_" + part.originalFilename;
    },
  });
  await form.parse(req);

  res.send("ok");
});

app.use(function (err, req, res, next) {
  res.status(500).json({ message: err.message });
} as express.ErrorRequestHandler);

app.use("*", (req, res) => {
  sendErrorRes(res, "Not Found!", 404);
});

server.listen(8000, () => {
  console.log("The app is running on http://localhost:8000");
});
