data modify storage math:internal w_comparison.predicate.power_needs_overflow_classification set compute default float math:internal/comparison/predicate/power/needs_overflow_classification/value
execute unless predicate math:internal/power/needs_overflow_classification run data remove storage math: ans
execute unless predicate math:internal/power/needs_overflow_classification run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/power/needs_overflow_classification run return fail
function math:pow/9.classify_overflow
data modify storage math:internal w_comparison.predicate.power_classifier_overflow set compute default float math:internal/comparison/predicate/power/classifier_overflow/value
execute if predicate math:internal/power/classifier_overflow run data remove storage math: ans
execute if predicate math:internal/power/classifier_overflow run data modify storage math: error set value "result_out_of_range"
execute if predicate math:internal/power/classifier_overflow run return fail
data modify storage math:internal x set compute default float math:power/classify/evaluation_exponent/00
function math:.common/exp/0.start
data modify storage math: ans set compute default float math:common/rounding/negate
data modify storage math:internal w_comparison.predicate.exp_result_finite set compute default float math:internal/comparison/predicate/exp/result_finite/value
execute unless predicate math:internal/exp/result_finite run data remove storage math: ans
execute unless predicate math:internal/exp/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/exp/result_finite run return fail
return 1
