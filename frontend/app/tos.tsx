import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content:
      'By accessing or using Sports Builds Market ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.',
  },
  {
    title: '2. User-Generated Content',
    content:
      'All build templates listed on the Platform are created and submitted by independent users ("Sellers"). Sports Builds Market does not create, verify, endorse, or guarantee any build template. Templates are provided "as is" for informational and entertainment purposes only.',
  },
  {
    title: '3. No Affiliation with Game Publishers',
    content:
      'Sports Builds Market is an independent platform and is NOT affiliated with, endorsed by, sponsored by, or in any way connected to any video game publisher, developer, or intellectual property holder. All sports simulation games referenced in user listings are the property of their respective owners. Template names, positions, and attributes are generic descriptions created by users.',
  },
  {
    title: '4. Predictions are Estimates Only',
    content:
      'Any compatibility scores, predicted win rate boosts, performance estimates, or outcome predictions displayed on the Platform are generated algorithmically based on user-provided data. These estimates are NOT guarantees of in-game performance. Actual results will vary based on game updates, network conditions, individual skill, and other factors. Users assume all risk related to purchase decisions.',
  },
  {
    title: '5. Purchases and Refunds',
    content:
      'All sales are final. Build templates are digital goods delivered immediately upon purchase. Sports Builds Market does not offer refunds except in cases of verified seller fraud or failure to deliver the purchased import code. Disputes must be submitted within 14 days of purchase.',
  },
  {
    title: '6. Seller Responsibilities',
    content:
      'Sellers certify that: (a) submitted builds are their original work; (b) performance data is accurate and not fabricated; (c) builds do not infringe third-party intellectual property; (d) all import codes function as described. Sellers who submit false data may be permanently banned and may face legal action.',
  },
  {
    title: '7. Payments and Platform Fee',
    content:
      'Payments are processed via Stripe. Sellers receive 70% of each sale; 30% is retained by the Platform as a service fee. Stripe may deduct additional processing fees. Payouts are subject to Stripe\'s terms and standard payout schedules.',
  },
  {
    title: '8. Prohibited Conduct',
    content:
      'Users may not: (a) submit builds containing malicious code; (b) provide fraudulent performance data; (c) attempt to reverse-engineer the Platform; (d) use the Platform for money laundering or illegal activity; (e) harass other users. Violations may result in account termination and legal action.',
  },
  {
    title: '9. Intellectual Property',
    content:
      'The Sports Builds Market name, logo, and interface design are the property of the Platform operator. User-submitted content remains the intellectual property of the respective Seller. By submitting content, Sellers grant the Platform a non-exclusive license to display and promote their listings.',
  },
  {
    title: '10. Disclaimer of Warranties',
    content:
      'THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. WE DO NOT GUARANTEE UPTIME, ACCURACY OF COMPATIBILITY SCORES, OR SUITABILITY OF ANY BUILD FOR YOUR PLAYSTYLE.',
  },
  {
    title: '11. Limitation of Liability',
    content:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, SPORTS BUILDS MARKET SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING LOSS OF IN-GAME PERFORMANCE, LOSS OF GAME PROGRESS, OR ACCOUNT CONSEQUENCES.',
  },
  {
    title: '12. Governing Law',
    content:
      'These Terms shall be governed by applicable law. Any disputes shall be resolved through binding arbitration. Class action lawsuits are waived to the extent permitted by law.',
  },
  {
    title: '13. Changes to Terms',
    content:
      'We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance. Major changes will be communicated via in-app notice.',
  },
  {
    title: '14. Contact',
    content:
      'For questions about these Terms, disputes, or DMCA takedown requests, contact: legal@sportsbuilds.market',
  },
];

export default function TOSScreen() {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];
  const router = useRouter();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1E1B4B', paddingTop: 56, paddingBottom: 24, paddingHorizontal: 24 }}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 14 }}>
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>← Back</Text>
        </Pressable>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26, marginBottom: 6 }}>Terms of Service</Text>
        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>
          Last updated: February 2026
        </Text>
      </View>

      {/* Important disclaimer banner */}
      <View style={{ backgroundColor: '#FEF9C3', margin: 16, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#FDE047' }}>
        <Text style={{ color: '#854D0E', fontWeight: '800', fontSize: 14, marginBottom: 6 }}>
          ⚠ Important Disclaimer
        </Text>
        <Text style={{ color: '#92400E', fontSize: 13, lineHeight: 20 }}>
          Templates are user-generated; Sports Builds Market has no affiliation with any video game publishers or developers.
          All compatibility scores and performance predictions are estimates only.{' '}
          <Text style={{ fontWeight: '700' }}>Users assume all risk</Text> when purchasing and using build templates.
        </Text>
      </View>

      <View style={{ padding: 16, gap: 16, paddingBottom: 60 }}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={{ backgroundColor: t.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.border }}>
            <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 14, marginBottom: 8 }}>
              {section.title}
            </Text>
            <Text style={{ color: t.foreground, fontSize: 13, lineHeight: 21 }}>
              {section.content}
            </Text>
          </View>
        ))}

        <Pressable
          onPress={() => router.back()}
          style={{ backgroundColor: '#7C3AED', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>I Understand — Go Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
