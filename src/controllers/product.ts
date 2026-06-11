import { UploadApiResponse } from "cloudinary";
import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";
import cloudUploader, { cloudApi } from "src/cloud";
import ProductModel from "src/models/product";
import { sendErrorRes } from "src/utils/helper";

const uploadImage = (filePath: string): Promise<UploadApiResponse> => {
    return cloudUploader.upload(filePath, {
        width: 1280,
        height: 720,
        crop: 'fill'
    })
}

export const listProduct: RequestHandler = async (req, res) => {
    const { name, description, price, purchasingdate, category } = req.body;
    const newProduct = new ProductModel({ name, description, price, purchasingdate, category, owner: req.user.id });
    try {
        const {images} = req.files;
        const isMultipleImages = Array.isArray(images)

        if(isMultipleImages && images.length > 5){
            return sendErrorRes(res, "You can upload a maximum of 5 images.", 400);
        }

        let invalidfiletype = false;
        // if this is true meaning there are multiple images
        if(isMultipleImages){
            for(let img of images){
                if(!img.mimetype?.startsWith("image/")){
                    invalidfiletype = true;
                    break;
                }
            }
        }else{
                if(images){
                    if(!images.mimetype?.startsWith("image/")){
                    invalidfiletype = true;
                }
            }
        }
        if(invalidfiletype){
            return sendErrorRes(res, "Invalid file type. Only images are allowed.", 400);
        }
        // file upload 
        if (isMultipleImages) {
           const uploadPromise = images.map((file) => uploadImage(file.filepath));
        //    wait for image to coompletly upload
          const uploadResult = await Promise.all(uploadPromise)
            // add image url to product id 
            newProduct.images = uploadResult.map(({secure_url, public_id}) =>{
                return {url: secure_url, id: public_id}
            })
            newProduct.thumbnail = newProduct.images[0].url;
        }else{
            if(images){
               const {secure_url, public_id} = await uploadImage(images.filepath)
               newProduct.images = [{url: secure_url, id: public_id}]
               newProduct.thumbnail = secure_url;
            }
        }
        await newProduct.save();
        res.status(201).json({message: "Product created successfully", product: newProduct})
    } catch (error) {
        sendErrorRes(res, "Error saving product", 500);
    }
}

export const updateProduct: RequestHandler = async (req, res) => {
    const productId = req.params.id;
    if(isValidObjectId(productId)){
        return sendErrorRes(res, "Invalid product id", 422);
    }
    const { name, description, price, purchasingdate, category, thumbnail } = req.body;  

    const product = await ProductModel.findOneAndUpdate({_id: productId, owner: req.user.id}, { name, description, price, purchasingdate, category }, { new: true });
    if(!product) return sendErrorRes(res, "Product not found", 404);

    if(typeof thumbnail === "string") product.thumbnail = thumbnail;
    try {
        const {images} = req.files;
        const isMultipleImages = Array.isArray(images)

        if(isMultipleImages){
            if(product.images.length + images.length > 5){
                return sendErrorRes(res, "You can upload a maximum of 5 images.", 400);
            }
        }

        let invalidfiletype = false;
        // if this is true meaning there are multiple images
        if(isMultipleImages){
            for(let img of images){
                if(!img.mimetype?.startsWith("image/")){
                    invalidfiletype = true;
                    break;
                }
            }
        }else{
                if(images){
                    if(!images.mimetype?.startsWith("image/")){
                    invalidfiletype = true;
                }
            }
        }
        if(invalidfiletype){
            return sendErrorRes(res, "Invalid file type. Only images are allowed.", 400);
        }
        // file upload 
        if (isMultipleImages) {
           const uploadPromise = images.map((file) => uploadImage(file.filepath));
        //    wait for image to coompletly upload
          const uploadResult = await Promise.all(uploadPromise)
            // add image url to product id 
            const newImages = await uploadResult.map(({secure_url, public_id}) =>{
                return {url: secure_url, id: public_id}
            })
            product.images.push(...newImages);
        }else{
            if(images){
               const {secure_url, public_id} = await uploadImage(images.filepath) 
               product.images.push({url: secure_url, id: public_id})
            }
        }
        await product.save();
        res.status(201).json({message: "Product updated successfully"})
    } catch (error) {
        sendErrorRes(res, "Error saving product", 500);
    }
}

export const deleteProduct: RequestHandler = async (req, res) => {
    const productId = req.params.id;
    if(isValidObjectId(productId)){
        return sendErrorRes(res, "Invalid product id", 422);
    }

   const product = await ProductModel.findOneAndDelete({_id:productId, owner: req.user.id})
   if(!product) return sendErrorRes(res, "Product not found!", 404)
//    remove iimage from cloud
const images = product.images
    if(images.length){
       const ids = images.map(({id}) => id)
        await cloudApi.delete_resources(ids)
    }
     res.status(201).json({message: "Product deleted successfully"})
}
