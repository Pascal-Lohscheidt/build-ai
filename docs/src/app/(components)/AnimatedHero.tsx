'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Highlight } from 'prism-react-renderer'

// Configuration
const ANIMATION_CONFIG = {
  TYPING_SPEED: 5, // Milliseconds per character
  ANIMATION_START_DELAY: 500, // Delay before starting typing animation
  POST_TYPING_PAUSE: 2000, // How long to pause after typing completes
  AUTO_SWITCH_DELAY: 2000, // Delay before auto-switching to next tab
}

// Types
interface Tab {
  id: string
  name: string
  code: string
}

// UI Components
function TrafficLightsIcon(props: React.ComponentPropsWithoutRef<'svg'>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 42 10" fill="none" {...props}>
      <circle cx="5" cy="5" r="4.5" />
      <circle cx="21" cy="5" r="4.5" />
      <circle cx="37" cy="5" r="4.5" />
    </svg>
  )
}

function EditorHeader({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}) {
  return (
    <div className="flex items-center border-b border-slate-700 px-4 py-2">
      <TrafficLightsIcon className="h-2.5 w-auto stroke-slate-500/30" />
      <div className="ml-4 flex gap-2 text-xs text-slate-400">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex cursor-pointer items-center rounded-md border px-1.5 py-0.5 ${
              activeTab === tab.id
                ? 'border-slate-400 bg-slate-700/50 text-slate-200'
                : 'border-slate-500/30'
            }`}
          >
            {tab.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// The blinking cursor style
function CursorStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      @keyframes cursor-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      .typing-cursor {
        display: inline-block;
        width: 2px; 
        height: 1.2em;
        background-color: currentColor;
        margin-left: 2px;
        animation: cursor-blink 1s step-end infinite;
        vertical-align: middle;
      }
    `,
      }}
    />
  )
}

// Code preview with syntax highlighting
function CodePreview({
  code,
  showCursor,
}: {
  code: string
  showCursor: boolean
}) {
  return (
    <div className="p-4">
      <Highlight code={code} language="tsx" theme={{ plain: {}, styles: [] }}>
        {({ className, style, tokens, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto text-slate-200`}
            style={style}
          >
            <code>
              {tokens.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {line
                    .filter((token) => !token.empty)
                    .map((token, tokenIndex) => (
                      <span key={tokenIndex} {...getTokenProps({ token })} />
                    ))}
                  {lineIndex === tokens.length - 1 && showCursor && (
                    <span className="typing-cursor" />
                  )}
                  {'\n'}
                </Fragment>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  )
}

// Data
const CODE_TABS: Tab[] = [
  {
    id: 'client',
    name: 'ConversationPage.tsx',
    code: `import { useConversation } from '@m4trix/core/react';

export default function ConversationPage() {
  const { startRecording, stopRecording } = useConversation('/api/voice-chat', {
    autoPlay: true,
    onError: (state, error) => {
      console.error('Conversation error:', error);
    }
  });
  
  // ... jsx render ...
}`,
  },
  {
    id: 'server',
    name: 'route.ts',
    code: `import { NextRequest } from 'next/server';
import { Pump } from '@m4trix/core/stream';
import { /*...*/ } from '@/lib';

export async function POST(req: NextRequest) {
  // Process the incoming audio request
  const formData = await req.formData();
  const transcript = await transcribeFormData(formData);
  const agentStream = await getAgentResponse(transcript);
  
  // Process and return the stream
  return await Pump.from(agentStream)
    .filter(shouldChunkBeStreamed)
    .map(messageToText)
    .bundle(intoChunksOfMinLength(40))
    .map((text) => text.join("")) // convert array of strings to string
    .rechunk(ensureFullWords)
    .rechunk(fixBrokenWords)
    .onClose(handleCompletedAgentResponse)
    .slidingWindow(10, 1)
    .filter(filterOutIrrelevantWindows)
    .buffer(5)
    .map(textToSpeech)
    .sequenceStreams()
    .drainTo(httpStreamResponse());
}`,
  },
]

// Main component
export default function AnimatedHero() {
  // State
  const [visibleCode, setVisibleCode] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const [currentTabIndex, setCurrentTabIndex] = useState(0)
  const [fullAnimationCycleComplete, setFullAnimationCycleComplete] =
    useState(false)

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const animationComplete = useRef(false)
  const hasAnimatedOnce = useRef<Record<string, boolean>>({})

  const tabs = CODE_TABS
  const activeTab = tabs[currentTabIndex].id

  // Animation functions
  const startTypingAnimation = (codeToType: string, tabId: string) => {
    let currentIndex = 0
    const typingSpeed = ANIMATION_CONFIG.TYPING_SPEED

    const typeNextChar = () => {
      if (currentIndex <= codeToType.length) {
        setVisibleCode(codeToType.substring(0, currentIndex))
        currentIndex++
        timerRef.current = setTimeout(typeNextChar, typingSpeed)
      } else {
        // Typing is complete, mark this tab as animated
        hasAnimatedOnce.current[tabId] = true

        setTimeout(() => {
          setShowCursor(false)
          animationComplete.current = true

          // If we've animated all tabs, mark the full cycle as complete
          if (Object.keys(hasAnimatedOnce.current).length === tabs.length) {
            setFullAnimationCycleComplete(true)
          }

          // Auto-switch to next tab after delay if not the last tab
          if (
            currentTabIndex < tabs.length - 1 &&
            !fullAnimationCycleComplete
          ) {
            timerRef.current = setTimeout(() => {
              handleTabChange(tabs[currentTabIndex + 1].id)
            }, ANIMATION_CONFIG.AUTO_SWITCH_DELAY)
          }
        }, ANIMATION_CONFIG.POST_TYPING_PAUSE)
      }
    }

    // Start typing
    timerRef.current = setTimeout(
      typeNextChar,
      ANIMATION_CONFIG.ANIMATION_START_DELAY,
    )
  }

  // Event handlers
  const handleTabChange = (id: string) => {
    const newIndex = tabs.findIndex((tab) => tab.id === id)
    if (newIndex !== currentTabIndex) {
      // Clear any pending animations
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      // If full animation cycle is complete or we've already animated this tab, show code immediately
      if (fullAnimationCycleComplete || hasAnimatedOnce.current[id]) {
        setCurrentTabIndex(newIndex)
        setVisibleCode(tabs[newIndex].code)
        setShowCursor(false)
        return
      }

      // Otherwise, animate the tab if the current animation is complete
      if (animationComplete.current) {
        setCurrentTabIndex(newIndex)
        setVisibleCode('')
        setShowCursor(true)
        animationComplete.current = false
        startTypingAnimation(tabs[newIndex].code, id)
      }
    }
  }

  // Effects
  useEffect(() => {
    // Start initial animation
    startTypingAnimation(tabs[0].code, tabs[0].id)

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  // Render
  return (
    <div className="mx-auto mt-16 max-w-7xl px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-xl bg-slate-800 shadow-xl ring-1 ring-slate-700">
        <EditorHeader
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        <CursorStyle />
        <CodePreview code={visibleCode} showCursor={showCursor} />
      </div>
    </div>
  )
}
