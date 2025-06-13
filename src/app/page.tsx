import Link from "next/link";
import Image from "next/image";

export default function PortalHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-indigo-50 flex flex-col">
      {/* Hero Section */}
      <header className="w-full py-8 bg-white shadow-sm">
        <div className="container mx-auto flex justify-between items-center px-6">
          <div className="flex items-center space-x-3">
            <Image 
              src="/ss_icon.png" 
              alt="Stay Connected Logo" 
              width={40} 
              height={40} 
              className="rounded-lg"
            />
            <div className="text-2xl font-bold text-indigo-700">StayConnected</div>
          </div>
          <nav className="space-x-6 hidden md:block">
            <Link href="/features" className="text-gray-700 hover:text-indigo-700 font-medium">Features</Link>
            <Link href="/pricing" className="text-gray-700 hover:text-indigo-700 font-medium">Pricing</Link>
            <Link href="/about" className="text-gray-700 hover:text-indigo-700 font-medium">About</Link>
          </nav>
          <Link href="/sign-in" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition">Login</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <section className="max-w-2xl mt-16 mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 text-gray-900 leading-tight">
            Stay Connected in the Blink of AI
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8">
            Smart check-in reminders for your peace of mind. Get alerted if a loved one misses their routine check-in. <br />
            <span className="text-indigo-600 font-semibold">Automatic notifications, easy setup, and total control.</span>
          </p>
          <Link href="/sign-in" className="inline-block px-8 py-4 bg-indigo-600 text-white text-lg rounded-lg font-bold shadow hover:bg-indigo-700 transition mb-4">
            Start for Free
          </Link>
          <div className="text-sm text-gray-400">No credit card required</div>
        </section>

        {/* Introduction Video Section */}
        <section className="w-full max-w-4xl mx-auto mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">See How It Works</h2>
            <div className="relative w-full max-w-3xl mx-auto">
              <video 
                className="w-full rounded-lg shadow-md"
                controls
                poster="/ss_icon.png"
                preload="metadata"
              >
                <source src="/intro.mp4" type="video/mp4" />
                <p className="text-gray-600">
                  Your browser doesn't support video playback. 
                  <a href="/intro.mp4" className="text-indigo-600 hover:underline">
                    Download the video
                  </a> instead.
                </p>
              </video>
            </div>
            <p className="text-gray-600 mt-4">Watch our quick introduction to see how Stay Connected keeps your loved ones safe</p>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <span className="text-indigo-600 text-3xl mb-2">🔔</span>
            <h3 className="font-bold text-lg mb-2">Auto Notifications</h3>
            <p className="text-gray-600 text-sm">Email & SMS alerts if no check-in happens by the deadline.</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <span className="text-indigo-600 text-3xl mb-2">📅</span>
            <h3 className="font-bold text-lg mb-2">Custom Events</h3>
            <p className="text-gray-600 text-sm">Schedule personalized check-ins for any purpose—daily, weekly, or custom.</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <span className="text-indigo-600 text-3xl mb-2">👥</span>
            <h3 className="font-bold text-lg mb-2">Contact Management</h3>
            <p className="text-gray-600 text-sm">Easily manage trusted contacts who get notified if you don't check in.</p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-2">Get Peace of Mind Today</h2>
          <p className="text-gray-600 mb-4">Try StayConnected free for 14 days. No credit card required.</p>
          <Link href="/sign-in" className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold shadow hover:bg-indigo-700 transition">
            Try Now
          </Link>
        </section>
      </main>

      <footer className="w-full py-6 bg-white border-t text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} StayConnected. All rights reserved.
      </footer>
    </div>
  );
}
