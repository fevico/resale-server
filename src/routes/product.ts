import { Router } from "express";
import { listProduct } from "src/controllers/product";
import { isAuth } from "src/middleware/auth";
import fileParser from "src/middleware/fileParser";
import validate from "src/middleware/validator";
import { newProductSchema } from "src/utils/validationSchema";

const productRouter = Router()

productRouter.post("/list", isAuth, fileParser, validate(newProductSchema), listProduct)

export default productRouter;