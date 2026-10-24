import { AppDataSource } from "./database";
import { Product } from "./entities/Product";
import { ensureStock } from "./services/stock.service";

export async function seedIfEmpty(): Promise<void> {
    const products = AppDataSource.getRepository(Product);
    let product = await products.findOneBy({ name: "MPhone Pro" });
    if (!product) {
        product = await products.save(products.create({
            name: "MPhone Pro",
            description: "Lightning deal. 50MP Camera and night mode. Stock is held for 5 minutes after you add it to your cart.",
            price: 24499,
            stock: 100,
            isActive: true,
            saleEndsAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        }));
    } else if (!product.saleEndsAt || product.saleEndsAt <= new Date()) {
        product.saleEndsAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
        await products.save(product);
    }

    const catalog = await products.findBy({ isActive: true });
    for (const item of catalog) {
        await ensureStock(item.id);
    }
}
