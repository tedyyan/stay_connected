import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50">
      {/* Header */}
      <header className="w-full py-8 bg-white shadow-sm">
        <div className="container mx-auto flex justify-between items-center px-6">
          <Link href="/" className="text-2xl font-bold text-indigo-700">StayConnected</Link>
          <nav className="space-x-6 hidden md:block">
            <Link href="/features" className="text-gray-700 hover:text-indigo-700 font-medium">Features</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-indigo-700 font-medium">Pricing</Link>
            <Link href="/about" className="text-indigo-700 hover:text-indigo-900 font-semibold">About</Link>
          </nav>
          <Link href="/sign-in" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition">Login</Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        {/* Hero Section */}
        <section className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-900">
            Peace of Mind, Powered by Technology
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            StayConnected was born from a simple idea: technology should help us care for the people we love, 
            especially when we can't be there in person.
          </p>
        </section>

        {/* Mission Section */}
        <section className="bg-white rounded-2xl shadow-lg p-12 mb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-gray-600 mb-6">
                We believe everyone deserves peace of mind when it comes to the safety and well-being of their loved ones. 
                Whether you're caring for an elderly parent, checking on a friend who lives alone, or ensuring your own 
                safety during solo adventures, StayConnected provides a simple, reliable safety net.
              </p>
              <p className="text-gray-600">
                Our platform combines smart automation with human connection, ensuring that help is always just a 
                missed check-in away.
              </p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">💙</div>
              <h3 className="text-xl font-bold text-indigo-700">Connecting Hearts, Ensuring Safety</h3>
            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">How It Started</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-indigo-600 text-4xl mb-4">💡</div>
              <h3 className="text-xl font-bold mb-4">The Problem</h3>
              <p className="text-gray-600">
                Millions of people live alone or engage in solo activities, leaving their loved ones worried 
                about their safety and well-being.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-indigo-600 text-4xl mb-4">🔧</div>
              <h3 className="text-xl font-bold mb-4">The Solution</h3>
              <p className="text-gray-600">
                A simple, automated system that monitors check-ins and alerts trusted contacts when 
                someone doesn't check in as scheduled.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="text-indigo-600 text-4xl mb-4">🌟</div>
              <h3 className="text-xl font-bold mb-4">The Impact</h3>
              <p className="text-gray-600">
                Thousands of families now have peace of mind, knowing they'll be alerted if their 
                loved ones need help.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-indigo-600 rounded-2xl p-12 mb-20 text-white">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-lg font-bold mb-2">Privacy First</h3>
              <p className="text-indigo-100 text-sm">
                Your data is encrypted and secure. We never share your information with third parties.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-lg font-bold mb-2">Reliability</h3>
              <p className="text-indigo-100 text-sm">
                Our system is built for 99.9% uptime. When it matters most, we're there.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-lg font-bold mb-2">Simplicity</h3>
              <p className="text-indigo-100 text-sm">
                Easy to set up, simple to use. Technology should work for you, not against you.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">❤️</div>
              <h3 className="text-lg font-bold mb-2">Care</h3>
              <p className="text-indigo-100 text-sm">
                Every feature is designed with genuine care for your safety and peace of mind.
              </p>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Who We Serve</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-indigo-600 text-4xl mb-4">🏔️</div>
              <h3 className="text-2xl font-bold mb-4">Solo Adventurers</h3>
              <p className="text-gray-600 mb-4">
                Hikers, travelers, and outdoor enthusiasts who venture alone can ensure someone is 
                alerted if they don't return on schedule. From weekend camping trips to solo travel 
                adventures, StayConnected provides a crucial safety net.
              </p>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-indigo-800 text-sm font-medium">
                  "I never worry about my solo hikes anymore. My family knows I'm safe, and I know 
                  they'll be alerted if something goes wrong." - Sarah, Avid Hiker
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-indigo-600 text-4xl mb-4">👴</div>
              <h3 className="text-2xl font-bold mb-4">Independent Seniors</h3>
              <p className="text-gray-600 mb-4">
                Elderly individuals living alone can maintain their independence while giving family 
                members peace of mind. Daily check-ins ensure that help is available when needed, 
                without being intrusive.
              </p>
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-indigo-800 text-sm font-medium">
                  "My children live far away, but they have peace of mind knowing I check in daily. 
                  It's simple and gives us all comfort." - Robert, 78
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Section */}
        <section className="bg-white rounded-2xl shadow-lg p-12 mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Built with Care</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-indigo-600 text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold mb-4">Enterprise Security</h3>
              <p className="text-gray-600">
                Bank-level encryption, secure data storage, and regular security audits ensure 
                your information is always protected.
              </p>
            </div>
            <div className="text-center">
              <div className="text-indigo-600 text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold mb-4">Multi-Platform</h3>
              <p className="text-gray-600">
                Access your dashboard from any device. Our responsive design works seamlessly 
                on desktop, tablet, and mobile.
              </p>
            </div>
            <div className="text-center">
              <div className="text-indigo-600 text-4xl mb-4">🔄</div>
              <h3 className="text-xl font-bold mb-4">Always Improving</h3>
              <p className="text-gray-600">
                We continuously update our platform based on user feedback and the latest 
                technology to serve you better.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Join Our Community</h2>
          <p className="text-xl mb-8 opacity-90">
            Thousands of families trust StayConnected for peace of mind. Join them today.
          </p>
          <Link href="/sign-in" className="inline-block px-8 py-4 bg-white text-indigo-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition mr-4">
            Start Free Trial
          </Link>
          <Link href="/features" className="inline-block px-8 py-4 border-2 border-white text-white rounded-lg font-bold text-lg hover:bg-white hover:text-indigo-600 transition">
            Learn More
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