data modify storage math: internal.x set from storage math: internal.y
function math:.common/truncate/0.start
data modify storage math: internal.w_comparison.predicate.power_exponent_integer set compute default float math:.validation/predicate/power/exponent_integer/value
execute unless predicate math:.validation/power/exponent_integer run data remove storage math: ans
execute unless predicate math:.validation/power/exponent_integer run data modify storage math: error set value "non_real_result"
execute unless predicate math:.validation/power/exponent_integer run return fail
return run function math:pow/4.negative_odd
