"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { useDropzone } from 'react-dropzone';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import toast from "react-hot-toast";
import { Knob } from 'primereact/knob';

function Typewriter({ text, speed = 35 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timerId = setTimeout(() => {
        setDisplayedText((prev) => prev + text.charAt(index));
        setIndex(index + 1);
      }, speed);

      return () => clearTimeout(timerId);
    }
  }, [text, speed, index]);

  const showDot = index < text.length;

  return (
    <>
      {renderTextWithLineBreaks(displayedText)}
      {showDot && <span className="typewriter-dot">â¢</span>}
    </>
  );
}

function renderTextWithLineBreaks(text: string) {
  const textSegments = text.split('\n');
  return (
    <>
      {textSegments.map((segment, index) => (
        <React.Fragment key={index}>
          <span className={index === 0 ? 'first-line' : ''}>{segment}</span>
          {index < textSegments.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  );
}

// Define the structure of a message
type Message = {
  id: any;
  role: "assistant" | "system" | "user";
  content: MessageContent[];
};

type MessageContent = TextContent | ImageContent;

type TextContent = {
  type: "text";
  text: string;
};

type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

// LoadingDots Component
function LoadingDots() {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((current) => (current + 1) % 4); // Cycle from 0 to 3
    }, 500); // Update every 500 milliseconds

    return () => clearInterval(interval);
  }, []);

  return <span>{'.'.repeat(dotCount)}</span>;
}

function ChatContainer() {
  const [images, setImages] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [feedbackIntensity, setFeedbackIntensity] = useState<number>(5); // State for slider value
  const chatContainerRef = useRef(null); // Adjust to directly reference the chat container div
  const endOfMessagesRef = useRef<HTMLElement | null>(null);
  const [selectedGPTStyle, setSelectedGPTStyle] = useState('ARTIE'); // default to ARTIE
      // Function to fetch images based on message
      const fetchImageForMessage = async (message: { role?: "assistant" | "system" | "user"; content?: MessageContent[]; text?: any; id?: any; }) => {
        const prompt = message.text; // Assuming the message object has a text property
        const options = {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt, n: 1, size: "1024x1024" }) // Adjust based on your needs
        };

        try {
            const response = await fetch("https://api.openai.com/v1/images/generations", options);
            const data = await response.json();
            if (data && data.data && data.data.length > 0) {
                setImages(prevImages => ({ ...prevImages, [message.id]: data.data[0].url }));
            }
        } catch (error) {
            console.error("Failed to fetch image:", error);
        }
    };

    // Effect to fetch images when messages update
    useEffect(() => {
        messages.forEach(message => {
            if (!images[message.id]) { // Check if image hasn't been fetched for this message
                fetchImageForMessage(message);
            }
        });
    }, [messages]); // Re-run effect if messages change
  

const handleGPTStyleChange = (event: { target: { value: React.SetStateAction<string>; }; }) => {
  setSelectedGPTStyle(event.target.value);
};


  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); // Dependency array includes messages to trigger scroll on update

  useEffect(() => {
    // Initialize MutationObserver to observe changes in the chat container
    const observer = new MutationObserver((mutations) => {
      // Whenever mutations are observed, scroll to the bottom of the chat container
      const chatContainer = chatContainerRef.current;
      if (chatContainer) {
        (chatContainer as HTMLElement).scrollTop = (chatContainer as HTMLElement).scrollHeight;
      }
    });

    if (chatContainerRef.current) {
      observer.observe(chatContainerRef.current, {
        childList: true, // Observe direct children additions or removals
        subtree: true, // Observe all descendants
      });
    }

    // Cleanup observer on component unmount
    return () => observer.disconnect();
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setImages((prevImages) => {
      const availableSlots = 5 - prevImages.length;
      const newImages = acceptedFiles.slice(0, availableSlots);
      return [...prevImages, ...newImages];
    });
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    multiple: true
  });

  const handleIntensityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFeedbackIntensity(Number(event.target.value));
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    setIsSending(true); // Disable send and upload buttons

    // Create the content array for the new user message
    const newUserMessageContent: MessageContent[] = [
      {
        type: "text" as const,
        text: message,
      },
      ...images.map((file) => ({
        type: "image_url" as const,
        // Temporary URLs for rendering - will be replaced by the backend response
        image_url: { url: URL.createObjectURL(file) },
      })),
    ];

    // Create a new user message object
    const newUserMessage: Message = {
      role: "user",
      content: newUserMessageContent as (TextContent | ImageContent)[],
      id: undefined
    };

    // Update the messages state to include the new user message
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);

    // Convert images to base64 strings for the backend
    const imagePromises = images.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    });

    const imageBase64Strings = await Promise.all(imagePromises);

// Construct the prompt based on selected GPT style
const promptText = selectedGPTStyle === 'ARTIE' ?
  `Describe this image as though you're an art director responding to an email, your name is ARTIE. Keep it very short, limit your response to maximum 1000 characters. Start your response with an email subject. Reply as though you're responding to the creative responsible for the image. Use industry jargon in your response. Mention the brand if you see any. Your feedback ranges from 1 which is very chill, to 10 which is very harsh. Don't mention your feedback intensity. Your feedback intensity is ${feedbackIntensity}.` :
  `Describe this image as though you're a therapeutic psychoanalyst, named RORI. You are taking part in a Rorschach test. Start you response saying 'I see'. Focus on symbolic elements and describe what it might make you feel. Be sure to include comments on shapes, color use, and emotion conveyed. Your response should not exceed 1000 characters. End with your name. Your feedback ranges from 1 which is very chill, to 10 which is very crazy. Don't mention your feedback intensity. Your feedback intensity is ${feedbackIntensity}.`;

const payload = {
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: promptText },
        ...imageBase64Strings.map((base64) => ({
          type: "image_url",
          image_url: { url: base64 },
        })),
      ],
    },
  ],
};

    try {
      // Send the message to the backend
      const response = await axios.post("/api/openai", payload);

      if (!response.data.success) {
        toast.error(response.data.error);
      }

      const newMessage = {
        ...response.data.message,
        text: `${response.data.message.text}`
      };
      setMessages((prevMessages) => [...prevMessages, newMessage]);
    } catch (error) {
      toast.error("Failed to upload file. Please try again.");
      // Optionally remove the user message if sending fails or handle the error as needed
    } finally {
      // Clear the message and images state, regardless of whether the send was successful
      setMessage("");
      setImages([]);
      setIsSending(false); // Re-enable send and upload buttons
    }
  };

  return (
  <div className="flex flex-col h-full">
    <div className="absolute top-5 text-sm left-5 p-4">
  Creative Feedback Simulator</div>
  <div className="absolute bottom-5 text-sm right-5 p-4">
    <img src="/images/logo.png" alt="Logo" className="w-auto h-10" /> {/* Adjust the src and styling as needed */}
  </div>
  <div className="absolute top-5 text-sm right-5 p-4">
  universestudio.xyz</div>
  <div className="absolute bottom-5 text-sm left-5 p-4">
  <div className="flex items-center mb-4">
    <span className="text-sm mr-2">Select GPT:</span>
    <select
      className="max-w-xs p-2 overflow-auto rounded-lg"
      aria-label="Default select example"
      defaultValue="ARTIE"
      onChange={handleGPTStyleChange}
    >
      <option value="ARTIE">ARTIE</option>
      <option value="RORI">RORI</option>
    </select>
  </div>

  <div className="flex items-center">
    <div>
      <label htmlFor="feedback-intensity-knob" className="block text-sm text-black mb-4">
          Response Intensity:
      </label>
      <div className="flex justify-center">
        <Knob
          value={feedbackIntensity}
          onChange={(e) => setFeedbackIntensity(e.value)}
          min={1}
          max={10}
          size={75}
          valueColor="#CFF940" 
          rangeColor="#A9A9A9"
        />
      </div>
    </div>
  </div>
</div>

<div className="chat-container flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
  {messages.map((message, idx) => (
    <div key={idx} className={`flex mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`rounded-lg p-4 mx-auto w-2/3 ${message.role === "user" ? "text-white" : message.role === "system" ? "bg-white text-white" : "p-8 shadow-lg bg-white text-lg text-black"}`}>
        {Array.isArray(message.content) ? (
          message.content.map((content, index) => (
            <React.Fragment key={index}>
              {content.type === "text" && <Typewriter text={content.text} />}
              {content.type === "image_url" && <img src={content.image_url.url} alt={`Uploaded by ${message.role}`} className="mx-auto h-[60vh] object-cover rounded-lg"/>}
            </React.Fragment>
          ))
        ) : (
          <Typewriter text={message.content} />
        )}
      </div>
    </div>
  ))}
  {/* Scroll marker placed here */}
  <div ref={endOfMessagesRef as React.RefObject<HTMLDivElement>} />
</div>
      {/* Image preview row */}
      {!isSending && (
  <div className="p-4 mx-auto">
    {images.map((image, index) => (
      <div key={index} className="relative inline-block">
        <img
          src={URL.createObjectURL(image)}
          alt={`upload-preview ${index}`}
          className="h-16 w-16 object-cover rounded-lg mr-2"
        />
        <button
          onClick={() => removeImage(index)}
          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs"
        >
          &times;
        </button>
      </div>
    ))}
  </div>
)}
      {/* Input area */}
      <div className="flex flex-row items-center justify-center">
  <div {...getRootProps()} className="flex text-sm flex-col items-center justify-center border-dashed border-2 border-gray-300 rounded-md p-4">
    <input {...getInputProps()} disabled={isSending} />
    {isSending ? (
      <p>Analyzing image<LoadingDots /></p>// Text shown when image is being sent
    ) : (
      <p>Drag & drop an image, or click here to upload a file.</p> // Default text
    )}
  </div>

  <button
    className="ml-4 flex justify-center items-center p-4 rounded-full text-gray-400 w-10 h-10" // Added ml-4 for margin-left
    style={{ backgroundColor: '#CFF940' }}
    onClick={sendMessage}
    disabled={isSending}
  >
    {isSending ? (
      <FontAwesomeIcon icon={faSpinner} className="h-5 w-5 fa-spin" />
    ) : (
      <FontAwesomeIcon icon={faArrowUp} className="h-5 w-5" />
    )}
  </button>
</div>
</div>
  );
}
export default ChatContainer;
