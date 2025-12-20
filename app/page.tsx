import { HomeScreen } from "@/src/components/home-screen";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-extrabold mb-8 text-center bg-linear-to-r from-red-600 to-yellow-500 bg-clip-text text-transparent">
          CARD NO MERCY
        </h1>
        <HomeScreen />
      </main>
    </div>
  );
}
