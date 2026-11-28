import 'package:flutter/material.dart';

/// TUGON colours: white surfaces with a blue accent. Red is kept for 911 and errors only.
class TugonColors {
  static const navy = Color(0xFF1E3A8A); // headings
  static const blue = Color(0xFF2563EB); // buttons, links, active items
  static const blueSoft = Color(0xFFEFF6FF); // selected / tinted backgrounds
  static const emergency = Color(0xFFDC2626);
  static const canvas = Color(0xFFFFFFFF);
  static const surface = Color(0xFFF8FAFC); // cards and inputs on white
  static const border = Color(0xFFE2E8F0);
  static const ink = Color(0xFF0F172A);
  static const muted = Color(0xFF64748B);
  static const success = Color(0xFF059669);
}

final _shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
const _buttonText = TextStyle(fontSize: 14, fontWeight: FontWeight.w600);
const _buttonSize = Size(0, 44);
const _buttonPadding = EdgeInsets.symmetric(horizontal: 18);

/// One light theme for the whole app (the app always uses it, even in phone dark mode).
ThemeData tugonTheme(Brightness brightness) => ThemeData(
      brightness: Brightness.light,
      useMaterial3: true,
      fontFamily: 'Inter',
      scaffoldBackgroundColor: TugonColors.canvas,
      colorScheme: ColorScheme.fromSeed(seedColor: TugonColors.blue).copyWith(
          primary: TugonColors.blue,
          surface: TugonColors.canvas,
          error: TugonColors.emergency),
      appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: TugonColors.canvas,
          foregroundColor: TugonColors.navy,
          titleTextStyle: TextStyle(
              fontFamily: 'Inter',
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: TugonColors.navy)),
      cardTheme: CardThemeData(
          color: TugonColors.canvas,
          elevation: 0,
          margin: const EdgeInsets.only(bottom: 10),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: const BorderSide(color: TugonColors.border))),
      filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
              backgroundColor: TugonColors.blue,
              foregroundColor: Colors.white,
              minimumSize: _buttonSize,
              padding: _buttonPadding,
              textStyle: _buttonText,
              shape: _shape)),
      outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
              foregroundColor: TugonColors.blue,
              minimumSize: _buttonSize,
              padding: _buttonPadding,
              textStyle: _buttonText,
              side: const BorderSide(color: TugonColors.border),
              shape: _shape)),
      textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
              foregroundColor: TugonColors.blue, textStyle: _buttonText)),
      chipTheme: const ChipThemeData(
          backgroundColor: TugonColors.blueSoft,
          side: BorderSide.none,
          labelStyle: TextStyle(color: TugonColors.navy)),
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: TugonColors.surface,
          prefixIconColor: TugonColors.muted,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TugonColors.border)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TugonColors.border)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: TugonColors.blue, width: 1.5)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13)));
