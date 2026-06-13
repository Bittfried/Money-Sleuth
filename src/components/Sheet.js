import React, { useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

export default function Sheet({ visible, onClose, children, variant = 'bottom' }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const centered = variant === 'center';
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        !centered && gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 100 || gesture.vy > 1.1) {
          translateY.setValue(0);
          onClose();
          return;
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modal} onTouchEnd={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.avoider, centered && styles.avoiderCentered]}
          pointerEvents="box-none"
        >
          <Animated.View
            onTouchEnd={(event) => event.stopPropagation()}
            style={[
              styles.panel,
              centered ? styles.dialog : styles.sheet,
              { paddingBottom: centered ? theme.spacing(5) : Math.max(insets.bottom, theme.spacing(5)) },
              !centered && { transform: [{ translateY }] },
            ]}
          >
            {!centered && (
              <View style={styles.handleTouch} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>
            )}
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: 'rgba(43,42,38,0.46)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  avoiderCentered: { justifyContent: 'center', padding: theme.spacing(4) },
  panel: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    paddingHorizontal: theme.spacing(5),
  },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderBottomWidth: 0,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    alignSelf: 'center',
    borderRadius: theme.radius.lg,
    paddingTop: theme.spacing(5),
  },
  handleTouch: { height: 36, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: theme.colors.line },
});
