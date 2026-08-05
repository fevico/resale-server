import "dotenv/config";
import "express-async-errors";
import "src/db";
import express from "express";
import authRouter from "routes/auth";
import formidable from "formidable";
import path from "path";
import productRouter from "./routes/product";
import { sendErrorRes } from "./utils/helper";
import {Server} from "socket.io"
import http from "http"
import { TokenExpiredError, verify } from "jsonwebtoken";
import morgan from  "morgan";
import conversationRouter from "./routes/conversation";

const app = express();
app.use(morgan("dev"));
const server = http.createServer(app)
const io = new Server(server, {
  path: "/socket-message"
})

app.use(express.static("src/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
app.use("/auth", authRouter);
app.use("/product", productRouter)
app.use("/conversation", conversationRouter)

// SOCKET IO
io.use((socket, next)=> { 
const socketReq = socket.handshake.auth as {token: string} | undefined
if(!socketReq?.token){
  return next(new Error("Unauthorized request!"))
}
try { 
  socket.data.jwtDecode = verify(socketReq.token, process.env.JWT_SECRET!)
} catch (error) {
      if (error instanceof TokenExpiredError) {
        return next(new Error("jwt expired!"))
      }
      return next(new Error("Invalid Token!"))
}
  next()
})

io.on("connection", (socket) => {
  console.log(socket.data)
console.log("user is connected")
})

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
  sendErrorRes(res, "Not Found!", 404)
}) 

server.listen(8000, () => {
  console.log("The app is running on http://localhost:8000");
});
