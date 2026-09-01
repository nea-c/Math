data remove storage math: error
data modify storage math:internal w_validation_a set compute default float math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default float math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_t set compute default float math:internal/comparison/finite/t
execute unless data storage math:internal {w_validation_t:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_max set compute default float math:internal/comparison/finite/max
execute unless data storage math:internal {w_validation_max:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_amplitude set compute default float math:internal/comparison/finite/amplitude
execute unless data storage math:internal {w_validation_amplitude:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_elastic_amplitude set compute default float math:elastic/input/amplitude
data modify storage math:internal w_validation_period set compute default float math:internal/comparison/finite/period
execute unless data storage math:internal {w_validation_period:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_comparison.predicate.elastic_duration_positive set compute default float math:internal/comparison/predicate/elastic/duration_positive/value
execute unless predicate math:internal/elastic/duration_positive run return run function math:.common/_error/invalid_duration
data modify storage math:internal w_comparison.predicate.elastic_amplitude_valid set compute default float math:internal/comparison/predicate/elastic/amplitude_valid/value
execute unless predicate math:internal/elastic/amplitude_valid run return run function math:.common/_error/invalid_elastic
data modify storage math:internal w_comparison.predicate.elastic_period_positive set compute default float math:internal/comparison/predicate/elastic/period_positive/value
execute unless predicate math:internal/elastic/period_positive run return run function math:.common/_error/invalid_elastic
data modify storage math:internal w_comparison.predicate.elastic_time_at_or_below_start set compute default float math:internal/comparison/predicate/elastic/time_at_or_below_start/value
execute if predicate math:internal/elastic/time_at_or_below_start run data modify storage math: ans set from storage math: a
execute if predicate math:internal/elastic/time_at_or_below_start run return 1
data modify storage math:internal w_comparison.predicate.elastic_time_at_or_after_end set compute default float math:internal/comparison/predicate/elastic/time_at_or_after_end/value
execute if predicate math:internal/elastic/time_at_or_after_end run data modify storage math: ans set from storage math: b
execute if predicate math:internal/elastic/time_at_or_after_end run return 1
execute if data storage math:internal {w_elastic_amplitude:1.0f} run data modify storage math:internal x set compute default float math:common/asin_positive/half_pi
execute if data storage math:internal {w_elastic_amplitude:1.0f} run return run function math:elastic/1.phase
data modify storage math:internal x set from storage math:internal w_elastic_amplitude
data modify storage math:internal y set value 1.0f
function math:.common/reciprocal/0.start
function math:.common/asin_positive/0.start
return run function math:elastic/1.phase
