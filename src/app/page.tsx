import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import PricingCard from "@/components/pricing-card";
import Footer from "@/components/footer";
import { createClient } from "../supabase/server";
import {
  ArrowUpRight,
  CheckCircle2,
  Bell,
  Clock,
  Shield,
  Users,
  AlertTriangle,
  Activity,
} from "lucide-react";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: plans, error } = await supabase.functions.invoke(
    "supabase-functions-get-plans",
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Navbar />
      <Hero />

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our Inactivity Alert System provides peace of mind with these
              powerful features.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <Bell className="w-6 h-6" />,
                title: "Smart Notifications",
                description: "Automatic alerts when check-ins are missed",
              },
              {
                icon: <Shield className="w-6 h-6" />,
                title: "Privacy First",
                description: "Your data is encrypted and secure",
              },
              {
                icon: <Clock className="w-6 h-6" />,
                title: "Flexible Scheduling",
                description: "Daily, weekly, or monthly check-ins",
              },
              {
                icon: <Activity className="w-6 h-6" />,
                title: "Activity Logging",
                description: "Complete history of all check-ins",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-blue-600 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our simple three-step process keeps you connected and safe.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm text-center relative">
              <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-4">Set Your Schedule</h3>
              <p className="text-gray-600">
                Choose how often you need to check in and who should be notified
                if you miss one.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm text-center relative">
              <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-4">Check In Regularly</h3>
              <p className="text-gray-600">
                Simply click the "I'm Here" button before your scheduled
                deadline.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm text-center relative">
              <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-4">Automatic Alerts</h3>
              <p className="text-gray-600">
                If you miss a check-in, your contacts are automatically notified
                through your preferred methods.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Who Can Benefit</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our system helps people in many different situations stay safe.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-blue-50 p-8 rounded-xl">
              <h3 className="text-xl font-semibold mb-4">Solo Adventurers</h3>
              <p className="text-gray-600 mb-4">
                Hikers, travelers, and outdoor enthusiasts who venture alone can
                ensure someone is alerted if they don't return on schedule.
              </p>
              <div className="flex items-center text-blue-600">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <span className="font-medium">
                  Safety net for the unexpected
                </span>
              </div>
            </div>

            <div className="bg-blue-50 p-8 rounded-xl">
              <h3 className="text-xl font-semibold mb-4">
                Independent Seniors
              </h3>
              <p className="text-gray-600 mb-4">
                Elderly individuals living alone can maintain their independence
                while giving family members peace of mind.
              </p>
              <div className="flex items-center text-blue-600">
                <Users className="w-5 h-5 mr-2" />
                <span className="font-medium">Connected but independent</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gray-50" id="pricing">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the perfect plan for your needs. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans?.map((item: any) => (
              <PricingCard key={item.id} item={item} user={user} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Stay Connected?</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Set up your first check-in schedule in minutes and gain peace of
            mind today.
          </p>
          <a
            href="/sign-up"
            className="inline-flex items-center px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Get Started
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
