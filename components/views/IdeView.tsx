import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Spinner } from '../ui/Spinner';
import { CommandLineIcon, PaperAirplaneIcon, CodeBracketIcon, ArrowPathIcon, TrashIcon, BookmarkIcon, MicrophoneIcon, StopCircleIcon, MinimizeIcon, MaximizeIcon, PencilSquareIcon } from '../icons';
import { useSound } from '../utils/SoundManager';
import { useVoiceInput } from '../utils/useVoiceInput';

interface LanguageConfig {
  id: string;
  label: string;
  ext: string;
}

const LANGUAGES: LanguageConfig[] = [
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'javascript', label: 'Node.js', ext: '.js' },
  { id: 'react', label: 'React (TSX)', ext: '.tsx' },
  { id: 'html', label: 'HTML5', ext: '.html' },
  { id: 'css', label: 'CSS', ext: '.css' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
  { id: 'csharp', label: 'C#', ext: '.cs' },
  { id: 'php', label: 'PHP', ext: '.php' },
];

interface File {
  name: string;
  language: string;
  content: string;
}

interface Snippet {
  id: string;
  name: string;
  language: string;
  code: string;
}

const DEFAULT_FILES: File[] = [
  { 
    name: 'main.py', 
    language: 'python', 
    content: 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n-1)\n\nprint(f"Factorial of 5 is: {factorial(5)}")' 
  },
  { 
    name: 'script.js', 
    language: 'javascript', 
    content: 'const users = [\n  { id: 1, name: "Alice" },\n  { id: 2, name: "Bob" }\n];\n\nusers.forEach(user => {\n  console.log(`User ${user.id}: ${user.name}`);\n});' 
  },
];

const highlightCode = (code: string, language: string) => {
  let highlighted = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const keywords = /\b(def|return|if|else|elif|for|while|import|from|class|try|except|print|const|let|var|function|return|console|log|import|export|default|return|public|private|static|void|int|string|float)\b/g;
  const strings = /(".*?"|'.*?'|`.*?`)/g;
  const numbers = /\b\d+\b/g;
  const comments = /(\/\/.*|#.*)/g;
  const functions = /\b([a-zA-Z_]\w*)(?=\()/g;

  highlighted = highlighted
    .replace(strings, '<span class="token-string">$1</span>')
    .replace(comments, '<span class="token-comment">$1</span>')
    .replace(keywords, '<span class="token-keyword">$1</span>')
    .replace(functions, '<span class="token-function">$1</span>')
    .replace(numbers, '<span class="token-number">$1</span>');

  return highlighted;
};

export const IdeView: React.FC = () => {
  const { playSound } = useSound();
  const [files, setFiles] = useState<File[]>(DEFAULT_FILES);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'files' | 'snippets'>('files');
  const [output, setOutput] = useState<string[]>(['> CONSOLE_READY', '> TYPE "help" FOR COMMANDS...']);
  const [isRunning, setIsRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  
  // Terminal Input State
  const [terminalInput, setTerminalInput] = useState('');
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Rename State
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Voice Input
  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceInput((text) => {
    setPrompt((prev) => prev + (prev ? ' ' : '') + text);
  });

  const activeFile = files[activeFileIndex];
  const terminalRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // Fixed height for expanded terminal
  const terminalHeight = 300;
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [terminalMode, setTerminalMode] = useState<'terminal' | 'preview'>('terminal');
  const [previewSrc, setPreviewSrc] = useState<string>('');
  
  useEffect(() => {
    const saved = localStorage.getItem('ide_snippets');
    if (saved) {
        try { setSnippets(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Reset renaming state when switching files
  useEffect(() => {
      setIsRenaming(false);
  }, [activeFileIndex]);

  const highlightedCode = useMemo(() => {
    return highlightCode(activeFile.content, activeFile.language);
  }, [activeFile.content, activeFile.language]);

  const handleScroll = () => {
    if (editorRef.current && highlightRef.current) {
        highlightRef.current.scrollTop = editorRef.current.scrollTop;
        highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  };

  useEffect(() => {
      if (terminalRef.current && terminalMode === 'terminal') {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }
  }, [output, terminalMode]);

  const handleCreateFile = () => {
    const name = window.prompt("Filename (e.g., test.py):");
    if (name) {
      playSound('success');
      const ext = "." + name.split('.').pop();
      const lang = LANGUAGES.find(l => l.ext === ext)?.id || 'javascript';
      setFiles([...files, { name, language: lang, content: '' }]);
      setActiveFileIndex(files.length);
      setActiveTab('files');
    }
  };

  const handleStartRename = () => {
      setRenameValue(activeFile.name);
      setIsRenaming(true);
      playSound('click');
  };

  const handleFinishRename = () => {
      if (!isRenaming) return;
      
      const newName = renameValue.trim();
      if (newName && newName !== "" && newName !== activeFile.name) {
          const ext = "." + newName.split('.').pop();
          const lang = LANGUAGES.find(l => l.ext === ext);
          
          setFiles(prev => prev.map((file, idx) => {
              if (idx === activeFileIndex) {
                  return { 
                      ...file, 
                      name: newName,
                      language: lang ? lang.id : file.language
                  };
              }
              return file;
          }));
          playSound('success');
      }
      setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleFinishRename();
      } else if (e.key === 'Escape') {
          setIsRenaming(false);
      }
  };

  const handleDownloadFile = () => {
    const element = document.createElement("a");
    const file = new Blob([activeFile.content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = activeFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    playSound('success');
  };

  const handleDeleteFile = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation();
      playSound('click');
      if (files.length > 1) {
          const newFiles = files.filter((_, i) => i !== idx);
          setFiles(newFiles);
          if (activeFileIndex >= idx && activeFileIndex > 0) setActiveFileIndex(activeFileIndex - 1);
      }
  };

  const handleSaveSnippet = () => {
      const name = window.prompt("Snippet Name:", activeFile.name);
      if (name) {
          playSound('success');
          const newSnippet: Snippet = {
              id: Date.now().toString(),
              name,
              language: activeFile.language,
              code: activeFile.content
          };
          const updated = [...snippets, newSnippet];
          setSnippets(updated);
          localStorage.setItem('ide_snippets', JSON.stringify(updated));
          setActiveTab('snippets');
      }
  };

  const handleLoadSnippet = (snippet: Snippet) => {
      playSound('click');
      const newFiles = [...files];
      newFiles[activeFileIndex].content = snippet.code;
      setFiles(newFiles);
  };

  const handleDeleteSnippet = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      playSound('error');
      const updated = snippets.filter(s => s.id !== id);
      setSnippets(updated);
      localStorage.setItem('ide_snippets', JSON.stringify(updated));
  };

  const handleRunCode = async () => {
    playSound('click');
    setIsCollapsed(false);

    if (activeFile.language === 'html') {
        setTerminalMode('preview');
        const blob = new Blob([activeFile.content], { type: 'text/html' });
        setPreviewSrc(URL.createObjectURL(blob));
        return;
    }

    setTerminalMode('terminal');
    setIsRunning(true);
    const langLabel = LANGUAGES.find(l => l.id === activeFile.language)?.label || activeFile.language;
    setOutput(prev => [...prev, `> COMPILING [${langLabel}] ${activeFile.name}...`]);
    
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `
You are a code execution engine. Simulate the output of this ${langLabel} code.
Return ONLY the stdout/stderr. No markdown. No explanations.
CODE:
${activeFile.content}
            ` }]}
        });

        const result = response.text || "> NO_OUTPUT";
        setOutput(prev => [...prev, ...result.split('\n')]);
        setOutput(prev => [...prev, `> PROCESS_FINISHED (EXIT_0)`]);
        playSound('success');
    } catch (e: any) {
        setOutput(prev => [...prev, `> ERR: EXECUTION_HALTED`]);
        playSound('error');
    } finally {
        setIsRunning(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!prompt.trim()) return;
    playSound('type');
    setIsGenerating(true);
    const langLabel = LANGUAGES.find(l => l.id === activeFile.language)?.label || activeFile.language;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `Write valid ${langLabel} code for: ${prompt}. Return ONLY code. No markdown. If asking for a component, provide the full component code.` }]}
        });
        
        let code = response.text || '';
        code = code.replace(/^```[a-z]*\n/i, '').replace(/```$/, '');
        
        const newFiles = [...files];
        newFiles[activeFileIndex].content = code;
        setFiles(newFiles);
        setPrompt('');
        playSound('success');
    } catch (e) {
        setOutput(prev => [...prev, `> ERR: GEN_FAILED`]);
        playSound('error');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleTerminalSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        const cmd = terminalInput.trim();
        setOutput(prev => [...prev, `user@socialnot:~$ ${cmd}`]);
        setTerminalInput('');
        
        if (!cmd) return;

        const args = cmd.split(' ');
        const command = args[0].toLowerCase();

        switch (command) {
            case 'help':
                setOutput(prev => [...prev, '  help          - Show this list', '  clear         - Clear terminal', '  ls            - List project files', '  cat <file>    - Display file content', '  run           - Execute current file', '  open <file>   - Open file in editor', '  whoami        - Print current user']);
                break;
            case 'clear':
                setOutput([]);
                break;
            case 'ls':
                setOutput(prev => [...prev, ...files.map(f => `${f.name}\t[${f.language}]`)]);
                break;
            case 'cat':
                if (args[1]) {
                    const f = files.find(file => file.name === args[1]);
                    if (f) {
                        setOutput(prev => [...prev, ...f.content.split('\n')]);
                    } else {
                        setOutput(prev => [...prev, `cat: ${args[1]}: No such file`]);
                    }
                } else {
                    setOutput(prev => [...prev, 'usage: cat <filename>']);
                }
                break;
            case 'run':
                await handleRunCode();
                break;
            case 'open':
                 if (args[1]) {
                    const idx = files.findIndex(file => file.name === args[1]);
                    if (idx !== -1) {
                        setActiveFileIndex(idx);
                        setOutput(prev => [...prev, `Opened ${args[1]}`]);
                    } else {
                        setOutput(prev => [...prev, `open: ${args[1]}: No such file`]);
                    }
                } else {
                    setOutput(prev => [...prev, 'usage: open <filename>']);
                }
                break;
            case 'whoami':
                setOutput(prev => [...prev, 'root']);
                break;
            default:
                setOutput(prev => [...prev, `bash: ${command}: command not found`]);
        }
        playSound('type');
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg p-2 overflow-hidden relative transition-colors">
        <style dangerouslySetInnerHTML={{__html: `
            .token-keyword { color: #ff00ff; font-weight: bold; }
            .token-string { color: #ffff00; }
            .token-comment { color: #888; font-style: italic; }
            .token-number { color: #00ffff; }
            .token-function { color: #ffb000; }
        `}} />

        {/* Header */}
        <div className="flex items-center justify-between mb-2 border-b border-dim pb-2 px-2 shrink-0">
            <h2 className="text-xl font-bold text-primary uppercase flex items-center gap-2">
                <CodeBracketIcon className="w-6 h-6" /> DEV_CONSOLE
            </h2>
            <div className="flex gap-2">
                 <button onClick={handleDownloadFile} className="px-3 py-1 border border-dim text-primary text-xs font-bold hover:bg-dim uppercase hover:text-inv transition-colors">
                    [ EXPORT ]
                 </button>
                 <button onClick={handleSaveSnippet} className="px-3 py-1 border border-dim text-secondary text-xs font-bold hover:bg-dim uppercase transition-colors">
                    [ SAVE_SNIPPET ]
                 </button>
                 <button onClick={handleRunCode} disabled={isRunning} className="px-4 py-1 bg-primary text-inv font-bold text-xs hover:opacity-80 disabled:opacity-50 uppercase shadow-[0_0_10px_var(--c-primary)] hover:shadow-[0_0_15px_var(--c-primary)] transition-all">
                    {isRunning ? 'RUNNING...' : '[ RUN_CODE ]'}
                 </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-2 overflow-hidden min-h-0">
            {/* Sidebar (Files/Snippets) */}
            <div className="w-full md:w-56 term-panel flex flex-col flex-shrink-0 max-h-[200px] md:max-h-full">
                <div className="flex border-b border-dim">
                    <button 
                        onClick={() => { setActiveTab('files'); playSound('click'); }}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'files' ? 'bg-primary text-inv' : 'text-dim hover:bg-panel hover:text-primary'}`}
                    >
                        FILES
                    </button>
                    <button 
                        onClick={() => { setActiveTab('snippets'); playSound('click'); }}
                        className={`flex-1 py-2 text-[10px] font-bold uppercase transition-colors ${activeTab === 'snippets' ? 'bg-primary text-inv' : 'text-dim hover:bg-panel hover:text-primary'}`}
                    >
                        SNIPPETS
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-1 space-y-1">
                    {activeTab === 'files' ? (
                        <>
                            <div className="px-2 py-1 flex justify-between items-center text-[10px] text-primary font-bold border-b border-dim border-dashed mb-1">
                                <span>PROJECT_ROOT</span>
                                <button onClick={handleCreateFile}>[+]</button>
                            </div>
                            {files.map((file, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setActiveFileIndex(idx); playSound('click'); }}
                                    className={`w-full text-left px-2 py-1 text-xs font-mono font-bold truncate flex justify-between group transition-colors ${
                                        activeFileIndex === idx ? 'bg-dim text-primary' : 'text-dim hover:bg-panel hover:text-primary'
                                    }`}
                                >
                                    <span>{file.name}</span>
                                    {files.length > 1 && (
                                        <span onClick={(e) => handleDeleteFile(e, idx)} className="hover:text-alert opacity-0 group-hover:opacity-100">x</span>
                                    )}
                                </button>
                            ))}
                        </>
                    ) : (
                        <>
                            {snippets.length === 0 && <div className="p-2 text-[10px] text-dim text-center font-bold">NO_DATA</div>}
                            {snippets.map((snip) => (
                                <div key={snip.id} className="group flex items-center justify-between px-2 py-1 hover:bg-panel border-b border-dim/30">
                                    <button onClick={() => handleLoadSnippet(snip)} className="text-left text-xs font-bold text-secondary truncate flex-1">
                                        {snip.name}
                                    </button>
                                    <button onClick={(e) => handleDeleteSnippet(e, snip.id)} className="text-alert opacity-0 group-hover:opacity-100 px-1">
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="flex-1 term-panel relative flex flex-col min-h-0">
                    {/* Editor Toolbar */}
                    <div className="bg-panel border-b border-dim px-2 py-1 flex justify-between items-center z-10 h-8">
                         <div className="flex items-center gap-2">
                             <div className="flex items-center gap-2">
                                {isRenaming ? (
                                    <input
                                        ref={renameInputRef}
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={handleFinishRename}
                                        onKeyDown={handleRenameKeyDown}
                                        className="bg-bg text-primary font-bold text-xs border-b border-primary outline-none w-32"
                                    />
                                ) : (
                                    <span 
                                        onClick={handleStartRename} 
                                        className="text-xs text-primary font-bold cursor-pointer hover:text-inv hover:underline transition-colors"
                                        title="Click to rename"
                                    >
                                        {activeFile.name}
                                    </span>
                                )}
                                <button 
                                    onClick={handleStartRename} 
                                    className="text-secondary border border-secondary p-0.5 hover:bg-secondary hover:text-black transition-colors"
                                    title="RENAME"
                                >
                                    <PencilSquareIcon className="w-3 h-3" />
                                </button>
                             </div>
                         </div>
                         <select 
                            value={activeFile.language} 
                            onChange={(e) => {
                                const newLangId = e.target.value;
                                const newLangConfig = LANGUAGES.find(l => l.id === newLangId);
                                
                                setFiles(prev => prev.map((f, i) => {
                                    if (i === activeFileIndex) {
                                        let updatedName = f.name;
                                        if (newLangConfig) {
                                            const lastDotIndex = updatedName.lastIndexOf('.');
                                            if (lastDotIndex !== -1) {
                                                updatedName = updatedName.substring(0, lastDotIndex) + newLangConfig.ext;
                                            } else {
                                                updatedName = updatedName + newLangConfig.ext;
                                            }
                                        }
                                        return { ...f, language: newLangId, name: updatedName };
                                    }
                                    return f;
                                }));
                                playSound('click');
                            }}
                            className="bg-bg text-primary text-[10px] font-bold border border-dim px-1 uppercase outline-none focus:border-primary"
                         >
                            {LANGUAGES.map(lang => <option key={lang.id} value={lang.id}>{lang.label}</option>)}
                         </select>
                    </div>
                    
                    {/* Code Editor Container */}
                    <div className="flex-1 relative overflow-hidden bg-bg">
                        <pre
                            ref={highlightRef}
                            className="absolute inset-0 p-4 m-0 font-mono text-sm font-bold leading-relaxed pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: highlightedCode + '<br/>' }}
                        />
                        <textarea
                            ref={editorRef}
                            value={activeFile.content}
                            onChange={(e) => {
                                const val = e.target.value;
                                setFiles(prev => prev.map((f, i) => i === activeFileIndex ? { ...f, content: val } : f));
                            }}
                            onKeyDown={() => playSound('type')}
                            onScroll={handleScroll}
                            className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-primary p-4 font-mono text-sm font-bold leading-relaxed resize-none focus:outline-none z-10 whitespace-pre-wrap break-words placeholder-dim"
                            spellCheck={false}
                        />
                    </div>

                    {/* AI Input */}
                    <div className="p-2 bg-panel border-t border-dim flex gap-2 z-10">
                        <input 
                            type="text" 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter') { handleGenerateCode(); } else { playSound('type'); } }}
                            placeholder={isTranscribing ? "LISTENING..." : "INSTRUCT_AI_TO_WRITE_CODE..."}
                            className="flex-1 bg-bg border border-dim text-primary px-2 py-2 text-sm font-bold focus:border-primary outline-none placeholder-dim"
                            disabled={isTranscribing}
                        />
                        <button 
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`p-2 border transition-all ${isRecording ? 'bg-alert text-black border-alert animate-pulse' : 'border-dim text-primary hover:bg-dim'}`}
                            title="VOICE INPUT"
                        >
                            {isRecording ? <StopCircleIcon className="w-4 h-4" /> : <MicrophoneIcon className="w-4 h-4" />}
                        </button>
                        <button onClick={handleGenerateCode} disabled={isGenerating} className="text-primary border border-dim px-3 hover:bg-dim transition-colors">
                             {isGenerating ? <Spinner size="sm" /> : <PaperAirplaneIcon className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* Terminal */}
                <div 
                    className="term-panel flex flex-col shrink-0 transition-[height] duration-300 ease-in-out relative" 
                    style={{ height: isCollapsed ? '32px' : `${terminalHeight}px` }}
                >
                    <div className="bg-panel border-b border-dim px-2 py-1 flex justify-between items-center h-8 shrink-0">
                        <div className="flex gap-4">
                            <button 
                                onClick={() => { setTerminalMode('terminal'); setIsCollapsed(false); playSound('click'); }} 
                                className={`text-[10px] font-bold uppercase transition-colors ${terminalMode === 'terminal' ? 'text-primary' : 'text-primary/70 hover:text-inv'}`}
                            >
                                TERMINAL_OUTPUT
                            </button>
                            <button 
                                onClick={() => { setTerminalMode('preview'); setIsCollapsed(false); playSound('click'); }} 
                                className={`text-[10px] font-bold uppercase transition-colors ${terminalMode === 'preview' ? 'text-secondary' : 'text-primary/70 hover:text-inv'}`}
                            >
                                CODE_PREVIEW
                            </button>
                        </div>
                        <div className="flex gap-2 items-center">
                            {terminalMode === 'terminal' && (
                                <button onClick={() => { setOutput([]); playSound('click'); }} className="text-[10px] text-dim font-bold hover:text-primary uppercase">[CLEAR]</button>
                            )}
                            <button onClick={() => { setIsCollapsed(!isCollapsed); playSound('click'); }} className="text-primary hover:text-inv transition-colors" title={isCollapsed ? "Expand" : "Collapse"}>
                                {isCollapsed ? <MaximizeIcon className="w-4 h-4" /> : <MinimizeIcon className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 bg-black overflow-hidden relative">
                            {terminalMode === 'terminal' ? (
                                <div ref={terminalRef} onClick={() => terminalInputRef.current?.focus()} className="h-full overflow-y-auto p-2 font-mono text-xs font-bold text-[#00bd2f] space-y-1 cursor-text bg-[#050505]">
                                    {output.map((line, i) => (
                                        <div key={i} className="break-all border-l-2 border-transparent pl-1 whitespace-pre-wrap">{line}</div>
                                    ))}
                                    {isRunning && <div className="animate-pulse">{'>'} EXECUTING_SCRIPT...</div>}
                                    
                                    <div className="flex items-center gap-2 text-[#00ff41] mt-2">
                                        <span className="whitespace-nowrap">user@socialnot:~$</span>
                                        <input 
                                            ref={terminalInputRef}
                                            type="text" 
                                            value={terminalInput}
                                            onChange={(e) => setTerminalInput(e.target.value)}
                                            onKeyDown={handleTerminalSubmit}
                                            className="flex-1 bg-transparent border-none outline-none text-[#00ff41] caret-[#00ff41] font-bold"
                                            autoComplete="off"
                                            spellCheck="false"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full h-full bg-white relative">
                                    <iframe 
                                        src={previewSrc} 
                                        className="w-full h-full border-none"
                                        title="Code Preview" 
                                        sandbox="allow-scripts allow-same-origin allow-modals"
                                    />
                                    <button 
                                        onClick={() => { 
                                            const blob = new Blob([activeFile.content], { type: 'text/html' });
                                            setPreviewSrc(URL.createObjectURL(blob));
                                            playSound('click');
                                        }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded hover:bg-black border border-white"
                                        title="Refresh Preview"
                                    >
                                        <ArrowPathIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};