import { useMemo } from 'react';
import { View, Image } from 'react-native';
import qrcode from 'qrcode-generator';

// QR code dessiné en simples vues (pas de module natif) : des points ronds comme BeReal, les trois repères
// en carrés arrondis, et le logo Reiz au centre. Correction d'erreur « H » : le logo peut cacher le milieu.

export function QrCode({ value, size, color = '#000', logo }: { value: string; size: number; color?: string; logo?: any }) {
  const qr = useMemo(() => {
    const q = qrcode(0, 'H');
    q.addData(value);
    q.make();
    return q;
  }, [value]);

  const n = qr.getModuleCount();
  const cell = size / n;
  const logoCells = Math.ceil(n * 0.24) | 1; // impair : centré sur une case
  const logoStart = Math.floor((n - logoCells) / 2);
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  const inLogo = (r: number, c: number) => !!logo && r >= logoStart - 1 && r < logoStart + logoCells + 1 && c >= logoStart - 1 && c < logoStart + logoCells + 1;

  const dots: { r: number; c: number }[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c) && !inFinder(r, c) && !inLogo(r, c)) dots.push({ r, c });
  }
  const dot = cell * 0.82;

  const finder = (top: number, left: number) => (
    <View key={`${top}-${left}`} style={{ position: 'absolute', top: top * cell, left: left * cell, width: 7 * cell, height: 7 * cell, borderRadius: 2.2 * cell, borderWidth: cell, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 3 * cell, height: 3 * cell, borderRadius: cell, backgroundColor: color }} />
    </View>
  );

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel="QR code de ton profil Reiz">
      {dots.map(({ r, c }) => (
        <View key={`${r}.${c}`} style={{ position: 'absolute', top: r * cell + (cell - dot) / 2, left: c * cell + (cell - dot) / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
      ))}
      {finder(0, 0)}
      {finder(0, n - 7)}
      {finder(n - 7, 0)}
      {!!logo && (
        <View style={{ position: 'absolute', top: logoStart * cell, left: logoStart * cell, width: logoCells * cell, height: logoCells * cell, borderRadius: logoCells * cell * 0.24, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
          <Image source={logo} style={{ width: logoCells * cell * 0.78, height: logoCells * cell * 0.4 }} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}
