package kafka

import (
	"context"
	"fmt"
	"time"

	"apps/dataclaus-api/internal/core/ports"

	"github.com/rs/zerolog/log"
	"github.com/segmentio/kafka-go"
)

// Producer implements ports.EventProducer using segmentio/kafka-go.
type Producer struct {
	writer *kafka.Writer
}

// NewProducer creates a new Kafka producer.
func NewProducer(brokers []string) ports.EventProducer {
	w := &kafka.Writer{
		Addr:         kafka.TCP(brokers...),
		Balancer:     &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}

	return &Producer{writer: w}
}

// Publish sends a message to a Kafka topic.
func (p *Producer) Publish(ctx context.Context, topic string, key []byte, value []byte) error {
	msg := kafka.Message{
		Topic: topic,
		Key:   key,
		Value: value,
		Time:  time.Now().UTC(),
	}

	if err := p.writer.WriteMessages(ctx, msg); err != nil {
		log.Error().Err(err).Str("topic", topic).Msg("Failed to publish message to Kafka")
		return fmt.Errorf("failed to publish message: %w", err)
	}

	return nil
}

// Close closes the Kafka writer.
func (p *Producer) Close() error {
	if err := p.writer.Close(); err != nil {
		return fmt.Errorf("failed to close kafka writer: %w", err)
	}
	return nil
}
