package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/pkgerrors"
)

type Logger struct {
	zerolog.Logger
}

func New(level string) *Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack

	// Set log level
	var logLevel zerolog.Level
	switch level {
	case "debug":
		logLevel = zerolog.DebugLevel
	case "info":
		logLevel = zerolog.InfoLevel
	case "warn":
		logLevel = zerolog.WarnLevel
	case "error":
		logLevel = zerolog.ErrorLevel
	default:
		logLevel = zerolog.InfoLevel
	}

	// Console output for development, JSON for production
	output := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: time.RFC3339,
	}

	logger := zerolog.New(output).Level(logLevel).With().Timestamp().Caller().Logger()

	return &Logger{Logger: logger}
}

func (l *Logger) Debug(msg string) {
	l.Logger.Debug().Msg(msg)
}

func (l *Logger) Info(msg string) {
	l.Logger.Info().Msg(msg)
}

func (l *Logger) Warn(msg string) {
	l.Logger.Warn().Msg(msg)
}

func (l *Logger) Error(msg string) {
	l.Logger.Error().Msg(msg)
}

func (l *Logger) Fatal(msg string) {
	l.Logger.Fatal().Msg(msg)
}

func (l *Logger) WithField(key string, value interface{}) *Logger {
	newLogger := l.Logger.With().Interface(key, value).Logger()
	return &Logger{Logger: newLogger}
}

func (l *Logger) WithError(err error) *Logger {
	newLogger := l.Logger.With().Stack().Err(err).Logger()
	return &Logger{Logger: newLogger}
}
