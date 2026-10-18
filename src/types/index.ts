export type TShirtFit = "Oversized" | "Relaxed" | "Regular";

export type TShirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export interface ColorVariant {
  name: string;
  hex: string;
  images: string[];
  imageAlts?: string[];
}

export type ProductCategory =
  | "Hot Girl Stuff"
  | "Monday to Friday"
  | "Social Battery"
  | "Relationship Status"
  | "Brutally Honest"
  | "Everyday Chaos"
  | "Friday Mode";

export interface Product {
  id: string;
  slug: string;
  name: string;
  printedMessage: string;
  category: ProductCategory;
  tagline: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  fit: TShirtFit;
  colors: ColorVariant[];
  sizes: TShirtSize[];
  fabricComposition: string;
  gsm: number;
  printTechnique?: string;
  sleeve: "Half Sleeve" | "Drop Shoulder";
  neck: "Ribbed Collar" | "Mock Neck" | "Crew Neck";
  isGraphic: boolean;
  careInstructions: string[];
  stock: number;
  isNewDrop?: boolean;
  isBestseller?: boolean;
  isFeatured?: boolean;
  collectionSlug: "new-drops" | "graphic-tees" | "essentials" | "statement-prints";
  tags: string[];
  sku: string;
}

export interface Collection {
  id: string;
  slug: "new-drops" | "graphic-tees" | "essentials" | "statement-prints";
  name: string;
  title: string;
  tagline: string;
  description: string;
  heroImage: string;
  featuredProductCount: number;
}

export interface CartItem {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  color: string;
  size: TShirtSize;
  price: number;
  image: string;
  quantity: number;
  fit: TShirtFit;
  sku: string;
}

export interface WishlistItem {
  productId: string;
  productSlug: string;
  productName: string;
  price: number;
  image: string;
  fit: TShirtFit;
  color: string;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
}

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderTimelineItem {
  title: string;
  description: string;
  timestamp: string;
  completed: boolean;
  current?: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  deliveryAddress: Address;
  paymentMethod: "Razorpay (UPI / Cards / NetBanking)" | "Cash on Delivery";
  paymentStatus: "Completed" | "Pending" | "Demo Authorized";
  orderStatus: OrderStatus;
  trackingNumber: string;
  timeline: OrderTimelineItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "seller" | "admin";
  addresses: Address[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "Store Admin" | "Catalog Lead" | "Fulfillment Lead" | "Support Agent";
  permissions: string[];
  status: "active" | "inactive";
  lastActive: string;
}

export interface SizeMeasurement {
  size: TShirtSize;
  chestCm: number;
  lengthCm: number;
  shoulderCm: number;
  sleeveCm: number;
}
