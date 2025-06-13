import Link from "next/link";
import PricingCard from "@/components/pricing-card";
import { createClient } from "../../supabase/server";

export default async function Pricing() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: plans, error } = await supabase.functions.invoke('supabase-functions-get-plans');
    
    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50">
            {/* Header */}
            <header className="w-full py-8 bg-white shadow-sm">
                <div className="container mx-auto flex justify-between items-center px-6">
                    <Link href="/" className="text-2xl font-bold text-indigo-700">StayConnected</Link>
                    <nav className="space-x-6 hidden md:block">
                        <Link href="/features" className="text-gray-700 hover:text-indigo-700 font-medium">Features</Link>
                        <Link href="/pricing" className="text-indigo-700 hover:text-indigo-900 font-semibold">Pricing</Link>
                        <Link href="/about" className="text-gray-700 hover:text-indigo-700 font-medium">About</Link>
                    </nav>
                    <Link href="/sign-in" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition">Login</Link>
                </div>
            </header>

            <main className="container mx-auto px-6 py-16">
                {/* Hero Section */}
                <section className="text-center mb-20">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-900">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                        Choose the perfect plan for your needs. No hidden fees, no surprises. 
                        Start with our free trial and upgrade when you're ready.
                    </p>
                    <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
                        ✨ 14-day free trial • No credit card required
                    </div>
                </section>

                {/* Pricing Cards */}
                <section className="mb-20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                        {plans?.map((item: any) => (
                            <PricingCard key={item.id} item={item} user={user} />
                        ))}
                    </div>
                </section>

                {/* Features Comparison */}
                <section className="bg-white rounded-2xl shadow-lg p-12 mb-20">
                    <h2 className="text-3xl font-bold text-center mb-12">What's Included</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="text-center">
                            <div className="text-indigo-600 text-4xl mb-4">🔔</div>
                            <h3 className="text-xl font-bold mb-4">Smart Notifications</h3>
                            <ul className="text-gray-600 space-y-2 text-left">
                                <li>• Email alerts</li>
                                <li>• SMS notifications</li>
                                <li>• Real-time monitoring</li>
                                <li>• Multiple contacts</li>
                            </ul>
                        </div>
                        <div className="text-center">
                            <div className="text-indigo-600 text-4xl mb-4">⚙️</div>
                            <h3 className="text-xl font-bold mb-4">Flexible Setup</h3>
                            <ul className="text-gray-600 space-y-2 text-left">
                                <li>• Custom schedules</li>
                                <li>• Multiple events</li>
                                <li>• Timer reset button</li>
                                <li>• Event management</li>
                            </ul>
                        </div>
                        <div className="text-center">
                            <div className="text-indigo-600 text-4xl mb-4">📊</div>
                            <h3 className="text-xl font-bold mb-4">Advanced Features</h3>
                            <ul className="text-gray-600 space-y-2 text-left">
                                <li>• Activity history</li>
                                <li>• Detailed logging</li>
                                <li>• Contact management</li>
                                <li>• Status tracking</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="mb-20">
                    <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold mb-3">How does the free trial work?</h3>
                            <p className="text-gray-600">
                                Start with a 14-day free trial with full access to all features. 
                                No credit card required. Cancel anytime during the trial period.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold mb-3">Can I change plans later?</h3>
                            <p className="text-gray-600">
                                Yes! You can upgrade or downgrade your plan at any time. 
                                Changes take effect immediately with prorated billing.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold mb-3">What payment methods do you accept?</h3>
                            <p className="text-gray-600">
                                We accept all major credit cards, PayPal, and bank transfers for enterprise plans. 
                                All payments are processed securely.
                            </p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            <h3 className="text-lg font-bold mb-3">Is there a setup fee?</h3>
                            <p className="text-gray-600">
                                No setup fees, no hidden costs. You only pay for your chosen plan. 
                                Enterprise customers get dedicated onboarding support.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="text-center bg-indigo-600 rounded-2xl p-12 text-white">
                    <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
                    <p className="text-xl mb-8 opacity-90">
                        Join thousands of users who trust StayConnected for peace of mind.
                    </p>
                    <Link href="/sign-in" className="inline-block px-8 py-4 bg-white text-indigo-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition mr-4">
                        Start Free Trial
                    </Link>
                    <Link href="/features" className="inline-block px-8 py-4 border-2 border-white text-white rounded-lg font-bold text-lg hover:bg-white hover:text-indigo-600 transition">
                        View Features
                    </Link>
                </section>
            </main>

            {/* Footer */}
            <footer className="w-full py-6 bg-white border-t text-center text-gray-400 text-sm">
                &copy; {new Date().getFullYear()} StayConnected. All rights reserved.
            </footer>
        </div>
    );
}