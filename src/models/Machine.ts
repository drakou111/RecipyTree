import { Recipe } from './Recipe';

export class Machine {
    name: string;
    image: HTMLImageElement | null = null;
    pullsItems: boolean;
    inputSlots: number;
    outputSlots: number;
    recipes: Recipe[] = [];

    private static loadedImages: Map<string, HTMLImageElement> = new Map();

    constructor(name: string, image: string, pullsItems: boolean, inputSlots: number, outputSlots: number) {
        this.name = name;
        this.pullsItems = pullsItems;
        this.inputSlots = inputSlots;
        this.outputSlots = outputSlots;
        this.loadImage(image);
    }

    public async loadImage(imageUrl: string): Promise<void> {
        if (Machine.loadedImages.has(imageUrl)) {
            this.image = Machine.loadedImages.get(imageUrl)!;
            return;
        }

        const img = new Image();
        img.onload = () => {
            Machine.loadedImages.set(imageUrl, img);
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
