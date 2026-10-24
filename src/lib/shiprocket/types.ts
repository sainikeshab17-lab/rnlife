export interface ShiprocketOrderInput {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: number;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: number;
  shipping_is_billing: boolean;
  order_items: Array<{ name: string; sku: string; units: number; selling_price: number }>; 
  payment_method: "Prepaid" | "COD";
  shipping_charges: number;
  total_discount: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface ShiprocketCreateOrderResponse {
  order_id?: number;
  shipment_id?: number;
  status?: string;
}

export interface ShiprocketAwbResponse {
  awb_assign_status?: number;
  response?: { data?: { awb_code?: string; courier_name?: string; shipment_id?: number } };
}
