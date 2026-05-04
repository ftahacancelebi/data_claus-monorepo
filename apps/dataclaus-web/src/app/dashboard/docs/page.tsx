'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { Highlight, themes } from 'prism-react-renderer';
import { 
    Code,
    Copy,
    CheckCircle,
    DeviceMobile,
    Terminal,
    ArrowRight,
    ArrowLeft,
    Book,
    Rocket,
    Warning,
    Info,
    Play,
    CaretRight,
    FileCode,
    Cube,
    CurrencyDollar,
    Users,
    VideoCamera,
    ShieldCheck,
} from 'phosphor-react';

// ============================================================
// Types
// ============================================================

interface SDKDoc {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  version: string;
  color: string;
  bgColor: string;
  install: string;
  features: string[];
  sections: SDKSection[];
}

interface SDKSection {
  title: string;
  description: string;
  examples: CodeExample[];
}

interface CodeExample {
  title: string;
  description: string;
  code: string;
  language: 'typescript' | 'javascript' | 'bash' | 'tsx';
}

// ============================================================
// SDK Documentation Data
// ============================================================

const sdkDocs: SDKDoc[] = [
  {
    id: 'react-native',
    name: 'React Native SDK',
    description: 'Full-featured SDK for iOS and Android mobile apps with user identity linking, ad components, and earnings display.',
    icon: DeviceMobile,
    version: '2.0.0',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    install: 'npm install @dataclaus/sdk-react-native',
    features: ['User Identity Linking', 'Banner/Interstitial/Rewarded Ads', 'Earnings Display', 'Fraud Detection'],
    sections: [
      {
        title: 'Installation',
        description: 'Install the SDK and peer dependencies.',
        examples: [
          {
            title: 'Install Package',
            description: 'Add the SDK to your React Native project.',
            language: 'bash',
            code: `npm install @dataclaus/sdk-react-native

# Optional: Enhanced device fingerprinting
npm install react-native-device-info`,
          },
        ],
      },
      {
        title: 'User Identity',
        description: 'Link your app users to DataClaus accounts for earnings tracking.',
        examples: [
          {
            title: 'Link User After Login',
            description: 'Call linkUser() after your user authenticates.',
            language: 'tsx',
            code: `import { useIdentity } from '@dataclaus/sdk-react-native';

function AfterLogin({ user }) {
  const { linkUser, isLinked, earnings } = useIdentity({
    apiUrl: 'https://api.dataclaus.io',
    applicationId: 'YOUR_APP_ID',
  });

  useEffect(() => {
    linkUser({
      externalUserId: user.id,
      email: user.email,
    });
  }, [user]);

  if (isLinked) {
    return <Text>You've earned \${earnings?.totalEarned ?? 0}</Text>;
  }
  return <ActivityIndicator />;
}`,
          },
        ],
      },
      {
        title: 'Ad Components',
        description: 'Display ads and share revenue with your users automatically.',
        examples: [
          {
            title: 'Setup AdProvider',
            description: 'Wrap your app with AdProvider to enable ads.',
            language: 'tsx',
            code: `import { AdProvider } from '@dataclaus/sdk-react-native';

function App() {
  const { linkedUser } = useIdentity({ ... });
  
  if (!linkedUser) return <LoginScreen />;
  
  return (
    <AdProvider config={{
      apiUrl: 'https://api.dataclaus.io',
      applicationId: 'YOUR_APP_ID',
      userToken: linkedUser.userToken,
      testMode: __DEV__,
    }}>
      <Navigation />
    </AdProvider>
  );
}`,
          },
          {
            title: 'Banner Ad',
            description: 'Display a banner advertisement at the bottom of your screen.',
            language: 'tsx',
            code: `import { BannerAd } from '@dataclaus/sdk-react-native';

function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        {/* Your content */}
      </ScrollView>
      
      <BannerAd
        size="banner"
        onAdLoaded={() => console.log('Ad loaded')}
        onPaidEvent={(impression) => {
          console.log(\`Earned: $\${impression.revenue}\`);
        }}
      />
    </View>
  );
}`,
          },
          {
            title: 'Rewarded Ad',
            description: 'Let users watch ads for in-app rewards with highest revenue.',
            language: 'tsx',
            code: `import { useRewardedAd } from '@dataclaus/sdk-react-native';

function RewardButton() {
  const { isLoaded, load, show } = useRewardedAd({
    onRewarded: (reward) => {
      addCoins(reward.amount);
      showToast(\`You earned \${reward.amount} coins!\`);
    },
    onPaidEvent: (impression) => {
      console.log(\`Ad revenue: $\${impression.revenue}\`);
    },
  });

  useEffect(() => { load(); }, []);

  return (
    <TouchableOpacity
      onPress={async () => {
        await show();
        load(); // Preload next ad
      }}
      disabled={!isLoaded}
    >
      <Text>Watch Ad for 50 Coins</Text>
    </TouchableOpacity>
  );
}`,
          },
        ],
      },
      {
        title: 'Fraud Detection',
        description: 'Monitor for bots and ensure only real humans earn rewards.',
        examples: [
          {
            title: 'Check Fraud Score',
            description: 'Use the fraud detection hook to monitor user authenticity.',
            language: 'tsx',
            code: `import { useFraudDetection } from '@dataclaus/sdk-react-native';

function App() {
  const { fraudScore, isBot, signals } = useFraudDetection({
    sensitivityLevel: 'medium',
  });

  if (isBot) {
    console.warn('Bot detected:', signals);
    return null; // Don't show ads to bots
  }

  return <MainApp fraudScore={fraudScore} />;
}`,
          },
        ],
      },
    ],
  },
  {
    id: 'node',
    name: 'Node.js SDK',
    description: 'Server-side SDK for recording ad impressions, managing users, and fetching revenue data with HMAC authentication.',
    icon: Terminal,
    version: '2.0.0',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    install: 'npm install @dataclaus/sdk-node',
    features: ['Ad Impression Recording', 'HMAC Authentication', 'User Earnings API', 'Revenue Summaries'],
    sections: [
      {
        title: 'Installation',
        description: 'Install the SDK in your Node.js backend.',
        examples: [
          {
            title: 'Install Package',
            description: 'Add the SDK to your server project.',
            language: 'bash',
            code: `npm install @dataclaus/sdk-node`,
          },
        ],
      },
      {
        title: 'Initialize Client',
        description: 'Set up the DataClaus authentication client.',
        examples: [
          {
            title: 'Basic Setup',
            description: 'Initialize with your API key from the dashboard.',
            language: 'typescript',
            code: `import { DataClausAuth } from '@dataclaus/sdk-node';

const auth = new DataClausAuth({
  apiUrl: process.env.DATACLAUS_API_URL,
  apiKey: process.env.DATACLAUS_API_KEY,
});

// Get current ad rates
const rates = await auth.getAdRates();
console.log('Banner eCPM:', rates.banner.ecpm);
console.log('Rewarded eCPM:', rates.rewarded.ecpm);`,
          },
        ],
      },
      {
        title: 'Record Ad Impressions',
        description: 'Track ad views from your mobile app and distribute revenue.',
        examples: [
          {
            title: 'Express.js Endpoint',
            description: 'Create an endpoint for your mobile app to report ad impressions.',
            language: 'typescript',
            code: `import { DataClausAuth } from '@dataclaus/sdk-node';

const auth = new DataClausAuth({
  apiKey: process.env.DATACLAUS_API_KEY,
});

app.post('/api/ads/impression', async (req, res) => {
  const { userId, adType, revenue } = req.body;
  
  try {
    const result = await auth.recordAdImpression(
      process.env.DATACLAUS_APP_ID,
      userId,
      adType, // 'banner' | 'interstitial' | 'rewarded'
      revenue,
      { sessionId: req.body.sessionId }
    );

    res.json({
      success: true,
      impressionId: result.impressionId,
      userEarned: result.userShare,
      devEarned: result.devShare,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});`,
          },
        ],
      },
      {
        title: 'User Earnings',
        description: 'Fetch user earnings to display in your app.',
        examples: [
          {
            title: 'Get User Balance',
            description: 'Fetch earnings data for a specific user.',
            language: 'typescript',
            code: `app.get('/api/users/:userId/earnings', async (req, res) => {
  const earnings = await auth.getUserEarnings(req.params.userId);
  
  res.json({
    total: earnings.totalEarned,
    available: earnings.availableBalance,
    pending: earnings.pendingBalance,
    qualityScore: earnings.qualityScore,
  });
});`,
          },
        ],
      },
      {
        title: 'Revenue Summaries',
        description: 'Get aggregated revenue reports for your application.',
        examples: [
          {
            title: 'App Revenue Summary',
            description: 'Fetch monthly revenue data for your app.',
            language: 'typescript',
            code: `const summary = await auth.getAppRevenueSummary(
  process.env.DATACLAUS_APP_ID,
  'month' // 'today' | 'week' | 'month' | 'year' | 'all'
);

console.log('Total impressions:', summary.totalImpressions);
console.log('Gross revenue:', summary.totalGrossRevenue);
console.log('Your share:', summary.totalDevShare);
console.log('Average eCPM:', summary.averageEcpm);`,
          },
        ],
      },
    ],
  },
];

// ============================================================
// Syntax Highlighted Code Component
// ============================================================

function SyntaxHighlighter({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-xl overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={copyCode}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-white hover:bg-slate-700 z-10 h-8 w-8 p-0"
      >
        {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      </Button>
      <Highlight
        theme={themes.nightOwl}
        code={code.trim()}
        language={language as any}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre 
            className="p-4 text-sm overflow-x-auto font-mono leading-relaxed rounded-xl"
            style={{ ...style, margin: 0 }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="text-slate-500 select-none mr-4 text-xs w-6 inline-block text-right">
                  {i + 1}
                </span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function DocsPage() {
  const { user } = useAuth();
  const [activeSDK, setActiveSDK] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  if (!user) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const currentSDK = sdkDocs.find(s => s.id === activeSDK);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        {activeSDK && currentSDK ? (
          // ==================== SDK DETAIL VIEW ====================
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Back Button + Header */}
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSDK(null)}
                className="mb-4 text-slate-600 hover:text-slate-900 -ml-2"
              >
                <ArrowLeft size={18} className="mr-2" />
                Back to Documentation
              </Button>
              
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl ${currentSDK.bgColor} flex items-center justify-center`}>
                  <currentSDK.icon size={28} className={currentSDK.color} weight="duotone" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-slate-900">{currentSDK.name}</h1>
                    <Badge variant="outline" className="text-xs">v{currentSDK.version}</Badge>
                  </div>
                  <p className="text-slate-500">{currentSDK.description}</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-wrap gap-2">
              {currentSDK.features.map(f => (
                <Badge key={f} className="bg-slate-100 text-slate-700 border-0 px-3 py-1">
                  <CheckCircle size={12} className="mr-1.5 text-emerald-500" weight="fill" />
                  {f}
                </Badge>
              ))}
            </div>

            {/* Install Command */}
            <Card className="bg-slate-900 border-0">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Terminal size={20} className="text-emerald-400" />
                  <code className="text-slate-300 font-mono">{currentSDK.install}</code>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                  onClick={() => copyToClipboard(currentSDK.install, 'install')}
                >
                  {copied === 'install' ? <CheckCircle size={16} /> : <Copy size={16} />}
                </Button>
              </CardContent>
            </Card>

            {/* SDK Sections */}
            {currentSDK.sections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{section.title}</h2>
                  <p className="text-slate-500">{section.description}</p>
                </div>

                {section.examples.map((example, eIdx) => (
                  <Card key={eIdx} className="border border-slate-200 bg-white overflow-hidden">
                    <CardHeader className="pb-2 bg-slate-50/50">
                      <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                        <Code size={16} className="text-blue-500" />
                        {example.title}
                      </CardTitle>
                      <p className="text-sm text-slate-500">{example.description}</p>
                    </CardHeader>
                    <CardContent className="pt-0 p-0">
                      <SyntaxHighlighter code={example.code} language={example.language} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </motion.div>
        ) : (
          // ==================== LIST VIEW ====================
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">SDK Documentation</h1>
              <p className="text-slate-500 mt-1">
                Choose an SDK to view detailed integration guides and code examples.
              </p>
            </div>

            {/* Quick Start Banner */}
            <Card className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-0 overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[200%] bg-blue-500/10 rotate-12"></div>
                </div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                      <Rocket size={28} weight="duotone" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Quick Start Guide</h2>
                      <p className="text-slate-300">Get up and running in 3 simple steps</p>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">1</div>
                      <span>Install SDK</span>
                    </div>
                    <ArrowRight className="text-slate-600" />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">2</div>
                      <span>Link Users</span>
                    </div>
                    <ArrowRight className="text-slate-600" />
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">3</div>
                      <span>Display Ads</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SDK Cards */}
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Terminal size={20} weight="duotone" />
                Choose Your SDK
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {sdkDocs.map((sdk) => (
                  <motion.div
                    key={sdk.id}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card 
                      className="cursor-pointer hover:shadow-xl transition-all border border-slate-200 h-full"
                      onClick={() => setActiveSDK(sdk.id)}
                    >
                      <CardContent className="p-6">
                        <div className={`h-14 w-14 rounded-xl ${sdk.bgColor} flex items-center justify-center mb-4`}>
                          <sdk.icon size={28} className={sdk.color} weight="duotone" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-xl text-slate-900">{sdk.name}</h3>
                          <Badge variant="outline" className="text-[10px]">v{sdk.version}</Badge>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{sdk.description}</p>
                        
                        {/* Features */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {sdk.features.map(f => (
                            <Badge key={f} className="text-[10px] bg-slate-100 text-slate-600 border-0">{f}</Badge>
                          ))}
                        </div>
                        
                        {/* Install Command */}
                        <div className="bg-slate-900 rounded-lg p-3 flex items-center justify-between">
                          <code className="text-xs text-slate-300 font-mono truncate pr-2">{sdk.install}</code>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(sdk.install, sdk.id);
                            }}
                          >
                            {copied === sdk.id ? <CheckCircle size={14} /> : <Copy size={14} />}
                          </Button>
                        </div>

                        <div className="flex items-center justify-end mt-4 text-sm font-medium text-blue-600">
                          View Documentation
                          <CaretRight size={14} className="ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Important Notes */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-amber-50/80 border-amber-200/50 backdrop-blur-sm">
                <CardContent className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Warning size={20} className="text-amber-600" weight="duotone" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">API Key Security</h4>
                    <p className="text-sm text-amber-700">Never expose API keys in client-side code. Send data through your backend using the Node.js SDK.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50/80 border-blue-200/50 backdrop-blur-sm">
                <CardContent className="p-5 flex gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Info size={20} className="text-blue-600" weight="duotone" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">Test Mode</h4>
                    <p className="text-sm text-blue-700">Use <code className="bg-blue-100 px-1 rounded">testMode: true</code> during development to use test ads.</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Distribution Info */}
            <Card className="glass-panel border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <CurrencyDollar size={22} className="text-emerald-500" weight="duotone" />
                  Revenue Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">When ads are shown, revenue is automatically split based on your app configuration:</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <Users size={24} className="mx-auto text-emerald-600 mb-2" />
                    <p className="text-2xl font-bold text-emerald-700">50-90%</p>
                    <p className="text-sm text-emerald-600">User Share</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <Code size={24} className="mx-auto text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-blue-700">5-45%</p>
                    <p className="text-sm text-blue-600">Developer Share</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <ShieldCheck size={24} className="mx-auto text-slate-600 mb-2" />
                    <p className="text-2xl font-bold text-slate-700">5%</p>
                    <p className="text-sm text-slate-500">Platform Fee</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Integration Steps */}
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Play size={20} weight="duotone" />
                Integration Steps
              </h3>
              <div className="grid gap-4 md:grid-cols-4">
                {[
                  { num: 1, title: 'Create App', desc: 'Register your app in the dashboard.', icon: Cube, color: 'emerald' },
                  { num: 2, title: 'Install SDKs', desc: 'Add React Native + Node.js SDKs.', icon: Terminal, color: 'blue' },
                  { num: 3, title: 'Link Users', desc: 'Connect users to DataClaus accounts.', icon: Users, color: 'purple' },
                  { num: 4, title: 'Display Ads', desc: 'Add ad components and start earning.', icon: VideoCamera, color: 'orange' },
                ].map((step) => (
                  <Card key={step.num} className="glass-panel border-0 shadow-lg">
                    <CardContent className="p-5">
                      <div className={`h-10 w-10 rounded-full bg-${step.color}-100 text-${step.color}-600 flex items-center justify-center font-bold text-lg mb-3`}>
                        {step.num}
                      </div>
                      <h3 className="font-bold text-slate-900 mb-1">{step.title}</h3>
                      <p className="text-sm text-slate-500">{step.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
