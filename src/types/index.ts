export interface VendorResult {
    vendor: string;
    price: string;
    url: string;
}

export interface ShoppingListItem {
    part_name: string;
    specifications: string;
    reason: string;
    is_safety_warning: boolean;
    estimated_price?: string;
    vendor?: string;
    search_url?: string;
    image_url?: string;
    all_vendors?: VendorResult[];
}

export interface ProjectAnalysisResponse {
    core_controller: string;
    power_needs: string;
    safety_checking: string;
    shopping_list: ShoppingListItem[];
}
