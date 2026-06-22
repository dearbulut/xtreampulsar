import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { HeroSection } from '@/components/sections/HeroSection';
import { StatsSection } from '@/components/sections/StatsSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { ComparisonSection } from '@/components/sections/ComparisonSection';
import { MigrationSection } from '@/components/sections/MigrationSection';
import { PricingSection } from '@/components/sections/PricingSection';
import { CTASection } from '@/components/sections/CTASection';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <FeaturesSection />
        <ComparisonSection />
        <MigrationSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
