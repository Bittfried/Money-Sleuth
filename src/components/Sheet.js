import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

// Android edge-to-edge windows do not resize for the keyboard, and RN Modal renders in its own
// window where adjustResize does not apply either. So track the keyboard and inset manually
// instead of relying on KeyboardAvoidingView.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const showSub = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      setHeight(event.endCoordinates?.height ?? 0)
    );
    const hideSub = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

export default function Sheet({ visible, onClose, children, variant = 'bottom' }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const centered = variant === 'center';
  const keyboardHeight = useKeyboardHeight();
  const keyboardOpen = keyboardHeight > 0;

  useEffect(() => {
    if (visible) translateY.setValue(0);
  }, [translateY, visible]);

  // Only dismiss on an actual open -> closed transition. Sheets mount alongside screens that own
  // their own inputs (such as the Home search field), so dismissing on mount would steal focus.
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (wasVisible.current && !visible) Keyboard.dismiss();
    wasVisible.current = visible;
  }, [visible]);

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

  // Padding on the flex container shrinks its content box, so the panel's percentage maxHeight
  // resolves against the space left above the keyboard rather than the whole screen.
  const avoiderPadding = keyboardHeight + (centered ? theme.spacing(4) : 0);
  // Once the keyboard covers the bottom edge, the safe-area inset no longer needs reserving.
  const panelPaddingBottom = centered || keyboardOpen ? theme.spacing(5) : Math.max(insets.bottom, theme.spacing(5));

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modal}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[styles.avoider, centered && styles.avoiderCentered, { paddingBottom: avoiderPadding }]}
          pointerEvents="box-none"
        >
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[
              styles.panel,
              centered ? styles.dialog : styles.sheet,
              { paddingBottom: panelPaddingBottom },
              !centered && { transform: [{ translateY }] },
            ]}
          >
            {!centered && (
              <View style={styles.handleTouch} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>
            )}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: 'rgba(43,42,38,0.46)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  avoiderCentered: { justifyContent: 'center', paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(4) },
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
