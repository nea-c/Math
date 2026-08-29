data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_b set compute default math:internal/comparison/finite/b
execute unless data storage math:internal {w_validation_b:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_t set compute default math:internal/comparison/finite/t
execute unless data storage math:internal {w_validation_t:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_max set compute default math:internal/comparison/finite/max
execute unless data storage math:internal {w_validation_max:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_oscillations set compute default math:internal/comparison/finite/oscillations
execute unless data storage math:internal {w_validation_oscillations:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_validation_damping set compute default math:internal/comparison/finite/damping
execute unless data storage math:internal {w_validation_damping:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal w_comparison.predicate.elastic_decay_duration_positive.minimum set compute default math:internal/comparison/predicate/elastic_decay/duration_positive/minimum
execute unless predicate math:internal/elastic_decay/duration_positive run return run function math:.common/_error/invalid_duration
data modify storage math:internal w_comparison.predicate.elastic_decay_oscillations_positive.minimum set compute default math:internal/comparison/predicate/elastic_decay/oscillations_positive/minimum
execute unless predicate math:internal/elastic_decay/oscillations_positive run return run function math:.common/_error/invalid_elastic
data modify storage math:internal w_comparison.predicate.elastic_decay_damping_positive.minimum set compute default math:internal/comparison/predicate/elastic_decay/damping_positive/minimum
execute unless predicate math:internal/elastic_decay/damping_positive run return run function math:.common/_error/invalid_elastic
data modify storage math:internal w_comparison.predicate.elastic_decay_time_at_or_below_start.maximum set compute default math:internal/comparison/predicate/elastic_decay/time_at_or_below_start/maximum
execute if predicate math:internal/elastic_decay/time_at_or_below_start run data modify storage math: ans set from storage math: a
execute if predicate math:internal/elastic_decay/time_at_or_below_start run return 1
data modify storage math:internal w_comparison.predicate.elastic_decay_time_at_or_after_end.minimum set compute default math:internal/comparison/predicate/elastic_decay/time_at_or_after_end/minimum
execute if predicate math:internal/elastic_decay/time_at_or_after_end run data modify storage math: ans set from storage math: b
execute if predicate math:internal/elastic_decay/time_at_or_after_end run return 1
data modify storage math:internal x set from storage math: max
data modify storage math:internal y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math:internal w_elastic_decay_u set compute default math:elastic_decay/u
data modify storage math:internal x set compute default math:elastic_decay/exponent
function math:.common/exp/0.start
data modify storage math:internal w_elastic_decay_factor set from storage math:internal x
data modify storage math:internal x set compute default math:elastic_decay/angle
function math:.common/cos/0.start
data modify storage math:internal w_elastic_decay_cosine set from storage math:internal x
return run function math:elastic_decay/1.finish
