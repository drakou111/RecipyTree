import { Recipe } from './Recipe';

export class Item {
    id: string;
    name: string;
    price: number;
    image: HTMLImageElement | null = null;
    generator: boolean;
    container: boolean;
    usedIn: Recipe[] = [];
    producedBy: Recipe[] = [];

    private static loadedImages: Map<string, HTMLImageElement> = new Map();

    constructor(id: string, name: string, price: number, imageUrl: string, generator: boolean, container: boolean) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.loadImage(imageUrl);
        this.generator = generator;
        this.container = container;
    }

    private async loadImage(imageUrl: string): Promise<void> {
        if (Item.loadedImages.has(imageUrl)) {
            this.image = Item.loadedImages.get(imageUrl)!;
            return;
        }

        const img = new Image();
        img.onload = () => {
            Item.loadedImages.set(imageUrl, img);
            this.image = img;
        };
        img.onerror = (error) => {
            console.error(`Failed to load image for ${this.name}:`, error);
        };
        img.src = imageUrl;
    }

    public isLoaded(): boolean {
        return this.image !== null;
    }
}
