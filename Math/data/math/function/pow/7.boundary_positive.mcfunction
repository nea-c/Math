data modify storage math:internal w_comparison.predicate.power_needs_overflow_classification set compute default float math:.validation/predicate/power/needs_overflow_classification/value
execute unless predicate math:.validation/power/needs_overflow_classification run data remove storage math: ans
execute unless predicate math:.validation/power/needs_overflow_classification run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:.validation/power/needs_overflow_classification run return fail
function math:pow/9.classify_overflow
data modify storage math:internal w_comparison.predicate.power_classifier_overflow set compute default float math:.validation/predicate/power/classifier_overflow/value
execute if predicate math:.validation/power/classifier_overflow run data remove storage math: ans
execute if predicate math:.validation/power/classifier_overflow run data modify storage math: error set value "result_out_of_range"
execute if predicate math:.validation/power/classifier_overflow run return fail
data modify storage math:internal x set compute default float math:pow/classify/evaluation_exponent/00
function math:.common/exp/0.start
data modify storage math: ans set compute default float math:.common/input/x
data modify storage math:internal w_comparison.predicate.exp_result_finite set compute default float math:.validation/predicate/exp/result_finite/value
execute unless predicate math:.validation/exp/result_finite run data remove storage math: ans
execute unless predicate math:.validation/exp/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:.validation/exp/result_finite run return fail
return 1
