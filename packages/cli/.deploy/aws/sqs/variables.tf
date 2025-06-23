variable "event_sources" {
  description = "Map of SQS event source configurations"
  type = map(object({
    queue_name                         = string
    enabled                            = optional(bool, true)
    batch_size                         = optional(number, 10)
    maximum_batching_window_in_seconds = optional(number)
    function_response_types            = optional(list(string))

    # Scaling configuration
    scaling_config = optional(object({
      maximum_concurrency = number
    }))
  }))

  validation {
    condition = alltrue([
      for k, v in var.event_sources : v.batch_size >= 1 && v.batch_size <= 10000
    ])
    error_message = "Batch size must be between 1 and 10000."
  }
}

variable "lambda_name" {
  description = "Name of the Lambda function"
  type        = string
}
