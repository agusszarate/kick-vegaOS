import * as React from 'react';
import {useMemo, useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {qrMatrix, topicUrl} from '../lib/phone';
import {colors, px} from '../ui/theme';

export function SearchOverlay({onSubmit}: {onSubmit: (query: string) => void}) {
  const [text, setText] = useState('');
  return (
    <View style={styles.overlay}>
      <Text style={styles.heading}>Buscar canal</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => onSubmit(text)}
        placeholder="Nombre del canal"
        placeholderTextColor={colors.muted}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <Text style={styles.text}>
        Escribí y apretá OK (Enter). Atrás para cancelar.
      </Text>
    </View>
  );
}

const QR_SIZE = 320;

/**
 * QR code drawn with plain views: one view per run of dark squares in each
 * row, so a typical code needs a few hundred views instead of ~1000.
 */
function Qr({value}: {value: string}) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const cell = px(QR_SIZE) / matrix.length;
  const runs: {row: number; col: number; len: number}[] = [];
  matrix.forEach((cells, row) => {
    let col = 0;
    while (col < cells.length) {
      if (!cells[col]) {
        col++;
        continue;
      }
      const start = col;
      while (col < cells.length && cells[col]) {
        col++;
      }
      runs.push({row, col: start, len: col - start});
    }
  });
  return (
    <View style={styles.qrBox}>
      <View style={{width: px(QR_SIZE), height: px(QR_SIZE)}}>
        {runs.map((r) => (
          <View
            key={`${r.row}-${r.col}`}
            style={[
              styles.qrRun,
              {
                top: r.row * cell,
                left: r.col * cell,
                width: r.len * cell,
                height: cell,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function PhoneOverlay({topic}: {topic: string}) {
  const url = topicUrl(topic);
  return (
    <View style={styles.overlay}>
      <Text style={styles.heading}>Mandar desde el celular</Text>
      <Qr value={url} />
      <Text style={styles.text}>
        Escaneá el QR con el celular y escribí el nombre del canal o pegá un
        link de Kick. La tele lo abre sola. También podés usar la app ntfy y
        suscribirte a:
      </Text>
      <Text style={styles.code}>{url}</Text>
      <Text style={styles.text}>Atrás para volver.</Text>
    </View>
  );
}

export function Toast({text}: {text: string}) {
  return <Text style={styles.toast}>{text}</Text>;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    color: '#fff',
    fontSize: px(40),
    fontWeight: '700',
    marginBottom: px(24),
  },
  input: {
    width: px(900),
    fontSize: px(36),
    paddingHorizontal: px(24),
    paddingVertical: px(16),
    borderRadius: px(10),
    borderWidth: px(4),
    borderColor: colors.green,
    backgroundColor: '#111',
    color: '#fff',
    marginBottom: px(24),
  },
  text: {
    color: '#ccc',
    fontSize: px(24),
    maxWidth: px(1100),
    textAlign: 'center',
    lineHeight: px(34),
    marginTop: px(12),
  },
  code: {color: colors.green, fontSize: px(22), marginTop: px(12)},
  qrBox: {
    backgroundColor: '#fff',
    padding: px(16),
    borderRadius: px(12),
    marginBottom: px(12),
  },
  qrRun: {position: 'absolute', backgroundColor: '#000'},
  toast: {
    position: 'absolute',
    top: px(54),
    right: px(96),
    backgroundColor: colors.card,
    borderLeftWidth: px(6),
    borderLeftColor: colors.green,
    color: '#fff',
    paddingHorizontal: px(24),
    paddingVertical: px(16),
    fontSize: px(24),
    borderRadius: px(8),
    overflow: 'hidden',
  },
});
