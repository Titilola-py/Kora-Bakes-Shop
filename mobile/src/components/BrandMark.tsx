/** The Kora Bakes "K" seal, ported from the website's BrandMark component. */
import { View } from 'react-native';

export function BrandMark({ size = 28, color = '#17243B' }: { size?: number; color?: string }) {
  const stroke = size * 0.048;
  const fold = size * 0.088;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ width: size * 0.42, height: size * 0.56, justifyContent: 'center' }}>
        {/* vertical stem */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: fold,
            borderRadius: fold,
            backgroundColor: '#2457D6',
          }}
        />
        {/* upper fold */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: size * 0.24,
            width: size * 0.38,
            height: fold,
            borderRadius: fold,
            backgroundColor: '#2457D6',
            transform: [{ rotate: '-18deg' }],
          }}
        />
        {/* lower fold */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            bottom: size * 0.24,
            width: size * 0.38,
            height: fold,
            borderRadius: fold,
            backgroundColor: '#2457D6',
            transform: [{ rotate: '18deg' }],
          }}
        />
      </View>
    </View>
  );
}