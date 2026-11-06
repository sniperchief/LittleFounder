import { AcademySection } from "@/components/marketing/academy-section";
import { BuildSection } from "@/components/marketing/build-section";
import { FinalCta } from "@/components/marketing/final-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ParentsSection } from "@/components/marketing/parents-section";
import { PassportSection } from "@/components/marketing/passport-section";
import { PitchSection } from "@/components/marketing/pitch-section";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <AcademySection />
      <BuildSection />
      <PitchSection />
      <ParentsSection />
      <PassportSection />
      <FinalCta />
    </>
  );
}
