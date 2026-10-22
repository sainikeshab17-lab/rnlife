import { StoreLayout } from "@/components/layout/StoreLayout";
import { WearYourMoodBuilder } from "@/components/product/WearYourMoodBuilder";

export const metadata = {
  title: "Wear Your Mood | RIGHTNOWLIFE",
  description: "Choose a mood, find your words, and preview a custom tee design.",
};

export default function WearYourMoodPage() {
  return (
    <StoreLayout>
      <WearYourMoodBuilder />
    </StoreLayout>
  );
}
