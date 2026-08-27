function math:internal/power_classify_overflow
data modify storage math:comparison predicate.power_classifier_overflow.minimum set compute default math:internal/comparison/predicate/power/classifier_overflow/minimum
execute if predicate math:internal/power/classifier_overflow run data remove storage math: ans
execute if predicate math:internal/power/classifier_overflow run data modify storage math: error set value "result_out_of_range"
execute if predicate math:internal/power/classifier_overflow run return fail
data modify storage math:internal x set compute default math:power/classify/evaluation_exponent/00
function math:internal/exp_x
data modify storage math: ans set compute default math:common/rounding/negate
data modify storage math:comparison predicate.exp_result_finite.minimum set compute default math:internal/comparison/predicate/exp/result_finite/minimum
data modify storage math:comparison predicate.exp_result_finite.maximum set compute default math:internal/comparison/predicate/exp/result_finite/maximum
execute unless predicate math:internal/exp/result_finite run data remove storage math: ans
execute unless predicate math:internal/exp/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/exp/result_finite run return fail
return 1
