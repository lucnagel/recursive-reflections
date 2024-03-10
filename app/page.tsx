import ChatContainer from "./components/ChatContainer";


export default function Home() {
  return (
<main
      className="flex flex-col items-center justify-center w-full min-h-screen p-4 gap-4 md:flex-row md:p-8 bg-gray-100"
    >
      <div className="w-full">
        <div className="overflow-hidden card bg-transparent p-6 rounded-lg h-[95vh]">
          <ChatContainer />
        </div>
      </div>
    </main>
  );
}
