import { AppDataSource } from "../database";
import { AppError, isUniqueViolation } from "../errors";
import { Product } from "../entities/Product";
import { User } from "../entities/User";
import { ensureStock, getAvailableStock } from "./stock.service";

export type ProductView = {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    saleEndsAt: string | null;
    saleEnded: boolean;
};

export type SessionView = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
};

function toProductView(product: Product, stock: number): ProductView {
    const saleEndsAt = product.saleEndsAt ? new Date(product.saleEndsAt).toISOString() : null;
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        stock,
        saleEndsAt,
        saleEnded: Boolean(product.saleEndsAt && product.saleEndsAt <= new Date()),
    };
}

async function withStock(product: Product): Promise<ProductView> {
    const redisStock = await getAvailableStock(product.id);
    const stock = redisStock ?? await ensureStock(product.id);
    return toProductView(product, stock);
}

export async function openSession(clientId: string): Promise<SessionView> {
    const email = `${clientId}@browser.flashkart`;
    const users = AppDataSource.getRepository(User);
    let user = await users.findOneBy({ email });
    if (!user) {
        try {
            user = await users.save(users.create({
                firstName: "Shopper",
                lastName: clientId.slice(0, 4),
                email,
                isActive: true,
            }));
        } catch (error) {
            if (!isUniqueViolation(error)) {
                throw error;
            }
            user = await users.findOneByOrFail({ email });
        }
    }
    return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
    };
}

export async function getFeaturedProduct(): Promise<ProductView> {
    const products = AppDataSource.getRepository(Product);
    const product = await products.findOneBy({ name: "AeroBuds Pro", isActive: true })
        ?? await products.findOne({ where: { isActive: true }, order: { createdAt: "ASC" } });
    if (!product) {
        throw new AppError("No flash sale is available", 404, "PRODUCT_NOT_FOUND");
    }
    return withStock(product);
}

export async function getProduct(productId: string): Promise<ProductView> {
    const product = await AppDataSource.getRepository(Product).findOneBy({ id: productId, isActive: true });
    if (!product) {
        throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }
    return withStock(product);
}
