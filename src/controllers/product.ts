import { UploadApiResponse } from "cloudinary";
import { RequestHandler } from "express";
import { isValidObjectId } from "mongoose";
import cloudUploader, { cloudApi } from "src/cloud";
import ProductModel from "src/models/product";
import { sendErrorRes } from "src/utils/helper";
import { UserDocument } from "src/models/user";
import categories from "src/utils/categories";

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
            const oldImages = product.images?.length || 0;
            if(oldImages + images.length > 5){
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
            if(product.images) product.images.push(...newImages);
            else product.images = newImages; 
        }else{
            if(images){
               const {secure_url, public_id} = await uploadImage(images.filepath) 
               if(product.images)
               product.images.push({url: secure_url, id: public_id})
                else product.images = [{url: secure_url, id: public_id}]
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
    const images = product.images || []
    if(images.length){
       const ids = images.map(({id}) => id)
        await cloudApi.delete_resources(ids)
    }
     res.status(201).json({message: "Product deleted successfully"})
}

export const deleteProductImage: RequestHandler = async (req, res) => {
    const {productId, imageId} = req.params;
    if(isValidObjectId(productId)){
        return sendErrorRes(res, "Invalid product id", 422);
    }
    const product = await ProductModel.findOneAndUpdate({_id: productId, owner: req.user.id}, {
        $pull: {images: {id: imageId}}
    }, {new: true})
    if(!product) return sendErrorRes(res, "Product not found!", 404)
    if(product.thumbnail?.includes(imageId)){
        const images = product.images
        if(images)
        product.thumbnail = images[0].url;
        else product.thumbnail = ""
        await product.save();
    }
    await cloudUploader.destroy(imageId)
    res.status(200).json({message: "Image removed successfully"})
}

export const getProductDetail: RequestHandler = async (req, res) => {
    const {id} = req.params;
    if(isValidObjectId(id)){
        return sendErrorRes(res, "Invalid product id", 422);
    }
    const product = await ProductModel.findById(id).populate<{owner: UserDocument}>("owner")
    if(!product) return sendErrorRes(res, "Product not found!", 404)
    res.status(200).json({message: "Product detail retrieved successfully", product: {
        id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        purchasingdate: product.purchasingDate,
        images: product.images?.map(img => img.url) || [],
        thumbnail: product.thumbnail,
        seller: {
            id: product.owner._id,
            name: product.owner.name,
            avatar: product.owner.avatar?.url
        }
    }})
}

export const getProductByCategory: RequestHandler = async (req, res) => {
    const {category} = req.params;
    const {pageNo='1', limit='10'} = req.query as {pageNo: string, limit: string};
    if(!categories.includes(category)) return sendErrorRes(res, "Invalid category", 422);
    const products = await ProductModel.find({category}).sort('-createdAt').skip((+pageNo - 1) * +limit).limit(+limit);
   const listings = products.map(p => {
        return {
            id: p._id,
            name: p.name,
            thumbnail: p.thumbnail,
            category: p.category,
            price: p.price,
        }
    })
    res.json({products: listings})
}

export const getLatestProduct: RequestHandler = async (req, res) => {
    const products = await ProductModel.find().sort('-createdAt').limit(10)
   const listings = products.map(p => {
        return {
            id: p._id,
            name: p.name,
            thumbnail: p.thumbnail,
            category: p.category,
            price: p.price,
        }
    })
    res.json({products: listings})
}

export const getListings: RequestHandler = async (req, res) => {
    const {pageNo='1', limit='10'} = req.query as {pageNo: string, limit: string};
    const products = await ProductModel.find({owner: req.user.id}).sort('-createdAt').skip((+pageNo - 1) * +limit).limit(+limit);
   const listings = products.map(p => {
        return {
            id: p._id,
            name: p.name,
            thumbnail: p.thumbnail,
            category: p.category,
            price: p.price,
            images: p.images?.map(i=> i.url),
            description:p.description,
            date: p.purchasingDate,
            seller: {
                id: req.user.id,
                name: req.user.name,
                avatar: req.user.avatar
            }
        }
    })
    res.json({products: listings})
}
