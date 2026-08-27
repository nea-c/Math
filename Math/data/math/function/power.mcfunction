data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
execute unless predicate math:internal/finite/b run data remove storage math: ans
execute unless predicate math:internal/finite/b run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/b run return fail
data modify storage math:internal x set from storage math: a
data modify storage math:internal y set from storage math: b
execute if predicate math:internal/power/base_zero run return run function math:internal/power_zero
execute if predicate math:internal/range/negative run return run function math:internal/power_negative
return run function math:internal/power_positive
