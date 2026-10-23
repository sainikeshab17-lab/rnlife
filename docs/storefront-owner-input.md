# RIGHTNOWLIFE storefront owner input

The storefront code is prepared for review. Confirm these items before treating the corresponding content or data as final:

- **Opening stock:** physically count each of XS, S, M, L, XL, and XXL for designs `rnl-design-01` through `rnl-design-08`; enter counts through Admin → Warehouse Inventory after applying the new migration. The migration creates zero stock and does not set saleable quantities.
- **Size measurements:** verify chest width, body length, shoulder width, and sleeve length against actual production garments. The proposed charts use the values in the supplied request; chest widths were derived by halving circumference-equivalent values and starred sleeve values were estimated from screenshots. Keep the verification notice and asterisks until confirmation.
- **Returns and exchanges:** approve the current configured 7-day request window and supply the return address, item-condition/tag requirements, shipping charges, and exact pickup/replacement completion process.
- **Product claims:** verify the catalog's fabric composition, 260 GSM weight, raglan construction, print process, and care instructions against the supplier or garment labels before making them product guarantees.
- **Contact email delivery:** configure and verify `EMAIL_FROM` and `RESEND_API_KEY` for the existing Resend integration. The app routes public support messages to `contact@rightnowlife.com`; delivery has not been tested in this environment.
- **Model photographs:** the sampled couple image appears synthetic, so no asset is treated as verified genuine model photography. Public galleries now use product-only front and print/detail views. Supply approved, genuine photos of people wearing the actual production designs before adding model photography. Current product images remain the fallback.
- **Reviews:** no existing genuine customer reviews were found. New reviews require a delivered purchase, are held for admin moderation, and remain hidden from product pages until at least five approved verified-purchase reviews exist for that design.
- **Industry benchmark:** the separate table uses only S–XXL values from the supplied brief and is clearly labeled as a reference, never a product chart. The PDF attachment was unavailable in the workspace, so confirm its attribution and figures against the source before relying on it.
