'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { 
    Code,
    Copy,
    CheckCircle,
    DeviceMobile,
    Globe,
    Terminal,
    ArrowRight,
    Book,
    Lightning,
    Rocket,
    Key,
    ShieldCheck,
    Database,
    ChartBar,
    Warning,
    Info
} from 'phosphor-react';

const sdks = [
  {
    name: 'React Native SDK',
    description: 'Full-featured SDK for iOS and Android applications built with React Native.',
    icon: DeviceMobile,
    version: '1.2.0',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    install: 'npm install @dataclaus/sdk-react-native',
  },
  {
    name: 'Node.js SDK',
    description: 'Server-side SDK for Node.js applications and backend services.',
    icon: Terminal,
    version: '2.0.1',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    install: 'npm install @dataclaus/sdk-node',
  },
  {
    name: 'Web SDK',
    description: 'Lightweight SDK for browser-based applications and SPAs.',
    icon: Globe,
    version: '1.0.0',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    install: 'npm install @dataclaus/sdk-web',
  },
];

// Syntax highlighting helper
const highlightCode = (code: string) => {
  const keywords = ['import', 'export', 'default', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'async', 'await', 'from', 'new'];
  const types = ['DataClausProvider', 'DataClausClient', 'Button', 'YourApp', 'App', 'YourComponent'];
  
  const lines = code.split('\n');
  
  return lines.map((line, lineIndex) => {
    if (line.trim().startsWith('//')) {
      return <div key={lineIndex} className="text-slate-500 italic">{line}</div>;
    }
    
    const tokens: React.ReactNode[] = [];
    let remaining = line;
    let tokenIndex = 0;
    
    while (remaining.length > 0) {
      let matched = false;
      
      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push(<span key={tokenIndex++} className="text-amber-400">{stringMatch[0]}</span>);
        remaining = remaining.slice(stringMatch[0].length);
        matched = true;
        continue;
      }
      
      const jsxMatch = remaining.match(/^<\/?[\w]+/);
      if (jsxMatch) {
        tokens.push(<span key={tokenIndex++} className="text-pink-400">{jsxMatch[0]}</span>);
        remaining = remaining.slice(jsxMatch[0].length);
        matched = true;
        continue;
      }
      
      const jsxCloseMatch = remaining.match(/^\/>/);
      if (jsxCloseMatch) {
        tokens.push(<span key={tokenIndex++} className="text-pink-400">{jsxCloseMatch[0]}</span>);
        remaining = remaining.slice(jsxCloseMatch[0].length);
        matched = true;
        continue;
      }
      
      if (remaining[0] === '>' && tokens.length > 0) {
        tokens.push(<span key={tokenIndex++} className="text-pink-400">{'>'}</span>);
        remaining = remaining.slice(1);
        continue;
      }
      
      for (const keyword of keywords) {
        const regex = new RegExp(`^\\b${keyword}\\b`);
        if (regex.test(remaining)) {
          tokens.push(<span key={tokenIndex++} className="text-purple-400">{keyword}</span>);
          remaining = remaining.slice(keyword.length);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      
      for (const type of types) {
        const regex = new RegExp(`^\\b${type}\\b`);
        if (regex.test(remaining)) {
          tokens.push(<span key={tokenIndex++} className="text-cyan-400">{type}</span>);
          remaining = remaining.slice(type.length);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      
      const funcMatch = remaining.match(/^(\w+)(?=\()/);
      if (funcMatch) {
        tokens.push(<span key={tokenIndex++} className="text-blue-400">{funcMatch[0]}</span>);
        remaining = remaining.slice(funcMatch[0].length);
        continue;
      }
      
      const propMatch = remaining.match(/^(\w+)(?=:)/);
      if (propMatch) {
        tokens.push(<span key={tokenIndex++} className="text-sky-300">{propMatch[0]}</span>);
        remaining = remaining.slice(propMatch[0].length);
        continue;
      }
      
      const numMatch = remaining.match(/^\d+\.?\d*/);
      if (numMatch) {
        tokens.push(<span key={tokenIndex++} className="text-orange-400">{numMatch[0]}</span>);
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }
      
      const boolMatch = remaining.match(/^(true|false|null|undefined)/);
      if (boolMatch) {
        tokens.push(<span key={tokenIndex++} className="text-orange-400">{boolMatch[0]}</span>);
        remaining = remaining.slice(boolMatch[0].length);
        continue;
      }
      
      tokens.push(<span key={tokenIndex++} className="text-slate-300">{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
    
    return <div key={lineIndex}>{tokens}</div>;
  });
};

const codeExamples = {
  reactNative: `import { DataClausProvider, useDataClaus } from '@dataclaus/sdk-react-native';

// 1. Wrap your app with the provider
export default function App() {
  return (
    <DataClausProvider 
      apiKey="your_api_key"
      config={{ enableRecaptcha: true }}
    >
      <YourApp />
    </DataClausProvider>
  );
}

// 2. Use the hook to send data
function YourComponent() {
  const { ingest, verifyHuman } = useDataClaus();

  const handleSubmit = async (data) => {
    const isHuman = await verifyHuman();
    if (isHuman) {
      await ingest({
        event_type: 'user_action',
        payload: data,
        user_id: 'user_123'
      });
    }
  };

  return <Button onPress={handleSubmit}>Submit</Button>;
}`,
  node: `import { DataClausClient } from '@dataclaus/sdk-node';

// Initialize the client
const client = new DataClausClient({
  apiKey: process.env.DATACLAUS_API_KEY,
  projectId: 'your_project_id'
});

// Verify reCAPTCHA token
app.post('/api/verify', async (req, res) => {
  const { token, action } = req.body;
  
  const result = await client.verifyRecaptcha(token, {
    action,
    minScore: 0.5
  });

  if (result.success && result.score >= 0.5) {
    // Process legitimate request
    await client.ingest({
      event_type: action,
      user_id: req.user.id,
      metadata: { verified: true }
    });
    
    res.json({ verified: true, score: result.score });
  } else {
    res.status(403).json({ verified: false });
  }
});`
};

// Documentation sections
const docSections = [
  {
    id: 'overview',
    title: 'Overview',
    icon: Book,
    content: `DataClaus is a data infrastructure platform that enables developers to monetize user data while ensuring privacy compliance. Our SDKs make it easy to integrate verified, high-quality data collection into your applications.`
  },
  {
    id: 'authentication',
    title: 'Authentication',
    icon: Key,
    content: `All API requests require authentication via an API key. Include your key in the request header: \`Authorization: Bearer YOUR_API_KEY\`. Never expose your API key in client-side code.`
  },
  {
    id: 'security',
    title: 'Security',
    icon: ShieldCheck,
    content: `DataClaus uses industry-standard encryption (TLS 1.3) for all data in transit. reCAPTCHA v3 is integrated to verify human users and prevent bot traffic. All data is processed in compliance with GDPR and CCPA.`
  },
  {
    id: 'data-ingestion',
    title: 'Data Ingestion',
    icon: Database,
    content: `The ingest endpoint accepts structured JSON payloads. Each event must include an event_type, user_id, and optional metadata. Events are processed in real-time and scored for quality.`
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: ChartBar,
    content: `Access real-time analytics through your dashboard or via the API. Track ingestion volume, data quality scores, revenue, and user engagement metrics.`
  },
];

export default function DocsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'reactNative' | 'node'>('reactNative');
  const [copied, setCopied] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');

  if (!user) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-start gap-4">
         <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">SDK Documentation</h1>
            <p className="text-slate-500 mt-1">
              Everything you need to integrate DataClaus into your applications.
            </p>
         </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex flex-wrap gap-2">
        {docSections.map((section) => {
          const Icon = section.icon;
          return (
            <Button
              key={section.id}
              variant={activeSection === section.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(section.id)}
              className={activeSection === section.id ? 'bg-primary text-white' : 'bg-white'}
            >
              <Icon size={16} className="mr-2" />
              {section.title}
            </Button>
          );
        })}
      </div>

      {/* Active Section Content */}
      <Card className="glass-panel border-0 shadow-lg">
        <CardContent className="p-6">
          {docSections.filter(s => s.id === activeSection).map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.id}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon size={20} className="text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
                </div>
                <p className="text-slate-600 leading-relaxed">{section.content}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* SDK Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {sdks.map((sdk, index) => (
          <motion.div
            key={sdk.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-panel border-0 shadow-lg hover:shadow-xl transition-all h-full">
              <CardContent className="p-6">
                <div className={`h-12 w-12 rounded-xl ${sdk.bgColor} flex items-center justify-center mb-4`}>
                  <sdk.icon size={24} className={sdk.color} weight="duotone" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-slate-900">{sdk.name}</h3>
                  <Badge variant="outline" className="text-[10px]">v{sdk.version}</Badge>
                </div>
                <p className="text-sm text-slate-500 mb-4">{sdk.description}</p>
                
                <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                  <code className="text-xs text-slate-300 font-mono truncate pr-2">{sdk.install}</code>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                    onClick={() => copyToClipboard(sdk.install, sdk.name)}
                  >
                    {copied === sdk.name ? <CheckCircle size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Start Guide - with Syntax Highlighting */}
      <Card className="bg-slate-900 text-slate-300 border-slate-800 overflow-hidden">
        <CardHeader className="border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lightning size={24} className="text-amber-400" />
              <CardTitle className="text-white">Quick Start Guide</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={activeTab === 'reactNative' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('reactNative')}
                className={activeTab === 'reactNative' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}
              >
                <DeviceMobile size={16} className="mr-2" />
                React Native
              </Button>
              <Button 
                variant={activeTab === 'node' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('node')}
                className={activeTab === 'node' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}
              >
                <Terminal size={16} className="mr-2" />
                Node.js
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            {/* Line numbers gutter */}
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-slate-950 border-r border-slate-800 flex flex-col items-end pt-6 pr-3 text-xs text-slate-600 font-mono select-none">
              {codeExamples[activeTab].split('\n').map((_, i) => (
                <div key={i} className="leading-relaxed">{i + 1}</div>
              ))}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-800 z-10"
              onClick={() => copyToClipboard(codeExamples[activeTab], 'code')}
            >
              {copied === 'code' ? <CheckCircle size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
              {copied === 'code' ? 'Copied!' : 'Copy'}
            </Button>
            
            <pre className="p-6 pl-16 overflow-x-auto text-sm leading-relaxed font-mono">
              {highlightCode(codeExamples[activeTab])}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Important Notes */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-amber-50/80 border-amber-200/50 backdrop-blur-sm">
          <CardContent className="p-6 flex gap-4">
            <Warning size={24} className="text-amber-600 flex-shrink-0" weight="duotone" />
            <div>
              <h4 className="font-semibold text-amber-800 mb-1">API Key Security</h4>
              <p className="text-sm text-amber-700">Never expose your API keys in client-side code or public repositories. Always use environment variables for sensitive credentials.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50/80 border-blue-200/50 backdrop-blur-sm">
          <CardContent className="p-6 flex gap-4">
            <Info size={24} className="text-blue-600 flex-shrink-0" weight="duotone" />
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">Rate Limits</h4>
              <p className="text-sm text-blue-700">The API allows up to 1000 requests per minute. For higher limits, contact our enterprise team for a custom plan.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Steps */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg mb-4">1</div>
            <h3 className="font-bold text-slate-900 mb-2">Install SDK</h3>
            <p className="text-sm text-slate-500">
              Add the appropriate SDK to your project using npm or yarn.
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg mb-4">2</div>
            <h3 className="font-bold text-slate-900 mb-2">Configure API Key</h3>
            <p className="text-sm text-slate-500">
              Generate an API key from your dashboard and configure the SDK.
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg mb-4">3</div>
            <h3 className="font-bold text-slate-900 mb-2">Start Ingesting</h3>
            <p className="text-sm text-slate-500">
              Use the SDK methods to send verified, high-quality data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
