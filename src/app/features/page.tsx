import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50">
      {/* Header */}
      <header className="w-full py-8 bg-white shadow-sm">
        <div className="container mx-auto flex justify-between items-center px-6">
          <Link href="/" className="text-2xl font-bold text-indigo-700">StayConnected</Link>
          <nav className="space-x-6 hidden md:block">
            <Link href="/features" className="text-indigo-700 hover:text-indigo-900 font-semibold">Features</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-indigo-700 font-medium">Pricing</Link>
            <Link href="/about" className="text-gray-700 hover:text-indigo-700 font-medium">About</Link>
          </nav>
          <Link href="/sign-in" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition">Login</Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        {/* Hero Section */}
        <section className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-900">
            All the features you need to stay connected
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Our comprehensive suite of features ensures you never lose touch with what matters most. 
            From smart notifications to detailed logging, we've got you covered.
          </p>
        </section>

        {/* Main Features Grid */}
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-indigo-600 text-4xl mb-4">🔔</div>
            <h3 className="text-2xl font-bold mb-4">Real-time Notifications</h3>
            <p className="text-gray-600 mb-4">
              Send alerts via email and SMS when you miss a check-in. Our system monitors your activity 
              24/7 and instantly notifies your trusted contacts if something seems wrong.
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• Email notifications</li>
              <li>• SMS text alerts</li>
              <li>• Instant delivery</li>
              <li>• Multiple contact support</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-indigo-600 text-4xl mb-4">📅</div>
            <h3 className="text-2xl font-bold mb-4">Custom Events</h3>
            <p className="text-gray-600 mb-4">
              Define multiple events, each with unique timers and contact groups. Set up daily check-ins, 
              weekly calls, or custom schedules that fit your lifestyle.
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• Flexible scheduling</li>
              <li>• Multiple event types</li>
              <li>• Custom time intervals</li>
              <li>• Event-specific contacts</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-indigo-600 text-4xl mb-4">📱</div>
            <h3 className="text-2xl font-bold mb-4">Beautiful Dashboard</h3>
            <p className="text-gray-600 mb-4">
              Manage your events with ease from our elegant web interface. View all your check-ins, 
              reset timers, and monitor your activity from one central location.
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• Intuitive interface</li>
              <li>• Real-time status updates</li>
              <li>• One-click timer reset</li>
              <li>• Mobile responsive</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-indigo-600 text-4xl mb-4">👥</div>
            <h3 className="text-2xl font-bold mb-4">Contact Management</h3>
            <p className="text-gray-600 mb-4">
              Add and edit trusted contacts with full details. Store names, email addresses, 
              phone numbers, and even social media accounts for comprehensive communication.
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• Unlimited contacts</li>
              <li>• Multiple contact methods</li>
              <li>• Contact groups</li>
              <li>• Easy management</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-indigo-600 text-4xl mb-4">📊</div>
            <h3 className="text-2xl font-bold mb-4">Trigger History</h3>
            <p className="text-gray-600 mb-4">
              Keep a full log of past events and notifications. Search through your history, 
              track patterns, and ensure accountability with detailed records.
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• Complete activity log</li>
              <li>• Searchable history</li>
              <li>• Event tracking</li>
              <li>• Export capabilities</li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-indigo-600 text-4xl mb-4">🔒</div>
            <h3 className="text-2xl font-bold mb-4">Robust Logging</h3>
            <p className="text-gray-600 mb-4">
              Advanced logging system makes it easy to debug and track the site's functionality. 
              Monitor system health and ensure reliable operation.
            </p>
            <ul className="text-sm text-gray-500 space-y-2">
              <li>• System monitoring</li>
              <li>• Error tracking</li>
              <li>• Performance metrics</li>
              <li>• Reliability assurance</li>
            </ul>
          </div>
        </section>

        {/* Event Status Section */}
        <section className="bg-white rounded-2xl shadow-lg p-12 mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Event Status Management</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-red-50 rounded-xl">
              <div className="text-red-600 text-3xl mb-3">🗑️</div>
              <h4 className="font-bold text-red-800 mb-2">Deleted</h4>
              <p className="text-sm text-red-600">Event has been removed by the user</p>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-xl">
              <div className="text-green-600 text-3xl mb-3">▶️</div>
              <h4 className="font-bold text-green-800 mb-2">Running</h4>
              <p className="text-sm text-green-600">Event is active and waiting to be triggered</p>
            </div>
            <div className="text-center p-6 bg-orange-50 rounded-xl">
              <div className="text-orange-600 text-3xl mb-3">🚨</div>
              <h4 className="font-bold text-orange-800 mb-2">Triggered</h4>
              <p className="text-sm text-orange-600">Notification has been sent to contacts</p>
            </div>
            <div className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-gray-600 text-3xl mb-3">⏸️</div>
              <h4 className="font-bold text-gray-800 mb-2">Paused</h4>
              <p className="text-sm text-gray-600">Event is temporarily disabled</p>
            </div>
          </div>
        </section>

        {/* Integration Section */}
        <section className="text-center mb-20">
          <h2 className="text-3xl font-bold mb-8">Powerful Integrations</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-4xl mb-4">📧</div>
              <h3 className="text-xl font-bold mb-4">SendGrid Integration</h3>
              <p className="text-gray-600">
                Reliable email delivery powered by SendGrid's industry-leading email infrastructure. 
                Ensure your notifications always reach their destination.
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold mb-4">Telnyx SMS</h3>
              <p className="text-gray-600">
                Fast and reliable SMS notifications through Telnyx API. Get instant text alerts 
                when it matters most, anywhere in the world.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center bg-indigo-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Experience all these features with our free trial. No credit card required.
          </p>
          <Link href="/sign-in" className="inline-block px-8 py-4 bg-white text-indigo-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition">
            Start Free Trial
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